package retention

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/Emyrk/chronicle/chronicle/riverqueue/riverconst"
	"github.com/Emyrk/chronicle/database"
	"github.com/Emyrk/chronicle/database/storage"
	"github.com/google/uuid"
	"github.com/riverqueue/river"
	"github.com/riverqueue/river/rivertype"
)

const KindRetention = "retention"

// ArgsRetention are the arguments for a retention job.
type ArgsRetention struct {
	DryRun bool `json:"dry_run"`
}

func (ArgsRetention) Kind() string { return KindRetention }

func (ArgsRetention) InsertOpts() river.InsertOpts {
	return river.InsertOpts{
		Queue:       riverconst.QueueRetention,
		Priority:    riverconst.PriorityLow,
		MaxAttempts: 3,
		UniqueOpts: river.UniqueOpts{
			ByArgs:  true,
			ByState: []rivertype.JobState{
				rivertype.JobStateScheduled,
				rivertype.JobStatePending,
				rivertype.JobStateAvailable,
				rivertype.JobStateRunning,
			},
		},
	}
}

// Worker processes retention jobs.
type Worker struct {
	river.WorkerDefaults[ArgsRetention]

	Store   database.Store
	Storage storage.ObjectStorage
	Logger  *slog.Logger
}

func (w *Worker) Work(ctx context.Context, job *river.Job[ArgsRetention]) error {
	logger := w.Logger.With(slog.Bool("dry_run", job.Args.DryRun))
	logger.InfoContext(ctx, "starting retention run")

	now := time.Now()

	// Get all realms with active retention policies.
	realmIDs, err := w.Store.GetRealmsWithRetentionPolicies(ctx)
	if err != nil {
		return fmt.Errorf("get realms with policies: %w", err)
	}

	var totalDeleted int64
	for _, realmID := range realmIDs {
		deleted, err := w.processRealm(ctx, realmID, now, job.Args.DryRun, logger)
		if err != nil {
			logger.ErrorContext(ctx, "retention failed for realm",
				slog.String("realm_id", realmID.String()),
				slog.String("error", err.Error()),
			)
			continue // Best-effort: continue with other realms
		}
		totalDeleted += deleted
	}

	logger.InfoContext(ctx, "retention run complete",
		slog.Int64("total_deleted", totalDeleted),
		slog.Int("realms_processed", len(realmIDs)),
	)
	return nil
}

func (w *Worker) processRealm(ctx context.Context, realmID uuid.UUID, now time.Time, dryRun bool, logger *slog.Logger) (int64, error) {
	// Get the effective policy for this realm.
	policy, err := w.Store.GetRetentionPolicyForRealm(ctx, uuid.NullUUID{UUID: realmID, Valid: true})
	if err != nil {
		return 0, fmt.Errorf("get policy: %w", err)
	}

	// Get ordered rules.
	dbRules, err := w.Store.GetRetentionRulesByPolicy(ctx, policy.ID)
	if err != nil {
		return 0, fmt.Errorf("get rules: %w", err)
	}

	rules := make([]Rule, len(dbRules))
	for i, r := range dbRules {
		conditions, err := ParseConditions(r.Conditions)
		if err != nil {
			return 0, fmt.Errorf("parse conditions for rule %d: %w", r.Priority, err)
		}
		rules[i] = Rule{
			Priority:    int(r.Priority),
			Action:      r.Action,
			Conditions:  conditions,
			Description: r.Description,
		}
	}

	// Fetch candidate instances.
	candidates, err := w.Store.GetInstancesForRetentionCheck(ctx, realmID)
	if err != nil {
		return 0, fmt.Errorf("get instances: %w", err)
	}

	var toDelete []uuid.UUID
	var toDeleteGroups []uuid.UUID
	for _, c := range candidates {
		candidate := instanceCandidateFromRow(c)

		result := Evaluate(rules, candidate, now)
		if result.Action == ActionDelete {
			toDelete = append(toDelete, c.ID)
			toDeleteGroups = append(toDeleteGroups, c.LogGroupID)
		}
	}

	logger.InfoContext(ctx, "retention evaluation complete",
		slog.String("realm_id", realmID.String()),
		slog.Int("candidates", len(candidates)),
		slog.Int("to_delete", len(toDelete)),
		slog.Bool("dry_run", dryRun),
	)

	if dryRun || len(toDelete) == 0 {
		return int64(len(toDelete)), nil
	}

	// Delete object storage first (per user request: we retry DB deletes).
	for _, groupID := range toDeleteGroups {
		// Best-effort storage cleanup. The files are stored under the log group path.
		_, _ = w.Storage.RemoveFile(ctx, "raidlogs", []string{groupID.String()})
	}

	// Delete from DB (cascades to encounters, speedruns, etc).
	deleted, err := w.Store.DeleteLogInstancesByIDs(ctx, toDelete)
	if err != nil {
		return 0, fmt.Errorf("delete instances: %w", err)
	}

	return deleted, nil
}

func instanceCandidateFromRow(c database.GetInstancesForRetentionCheckRow) InstanceCandidate {
	candidate := InstanceCandidate{
		ID:           c.ID,
		InstanceName: c.InstanceName,
		EndTime:      c.EndTime.Time,
		LogGroupID:   c.LogGroupID,
	}
	if c.GuildRank.Valid {
		candidate.GuildRank = &c.GuildRank.Int64
	}
	return candidate
}

// Preview runs the retention evaluation for a specific realm without deleting anything.
func Preview(ctx context.Context, store database.StoreQueries, realmID uuid.UUID, now time.Time) ([]PreviewItem, error) {
	policy, err := store.GetRetentionPolicyForRealm(ctx, uuid.NullUUID{UUID: realmID, Valid: true})
	if err != nil {
		return nil, fmt.Errorf("get policy: %w", err)
	}

	dbRules, err := store.GetRetentionRulesByPolicy(ctx, policy.ID)
	if err != nil {
		return nil, fmt.Errorf("get rules: %w", err)
	}

	rules := make([]Rule, len(dbRules))
	for i, r := range dbRules {
		conditions, err := ParseConditions(r.Conditions)
		if err != nil {
			return nil, fmt.Errorf("parse conditions: %w", err)
		}
		rules[i] = Rule{
			Priority:    int(r.Priority),
			Action:      r.Action,
			Conditions:  conditions,
			Description: r.Description,
		}
	}

	candidates, err := store.GetInstancesForRetentionCheck(ctx, realmID)
	if err != nil {
		return nil, fmt.Errorf("get instances: %w", err)
	}

	items := make([]PreviewItem, 0, len(candidates))
	for _, c := range candidates {
		candidate := instanceCandidateFromRow(c)

		result := Evaluate(rules, candidate, now)
		items = append(items, PreviewItem{
			InstanceID:   c.ID,
			InstanceName: c.InstanceName,
			EndTime:      c.EndTime.Time,
			Action:       result.Action,
			MatchedRule:  result.MatchedRule,
		})
	}
	return items, nil
}

// PreviewItem is a single instance's evaluation result.
type PreviewItem struct {
	InstanceID   uuid.UUID
	InstanceName string
	EndTime      time.Time
	Action       string  // "keep", "delete", or "" (no match = default keep)
	MatchedRule  *string
}

// MarshalMetadata serializes a summary for River job metadata.
func MarshalMetadata(deleted, evaluated int) json.RawMessage {
	data, _ := json.Marshal(map[string]int{
		"deleted":   deleted,
		"evaluated": evaluated,
	})
	return data
}
