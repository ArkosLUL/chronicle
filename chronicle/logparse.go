package chronicle

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"slices"
	"strings"
	"time"

	"github.com/Emyrk/chronicle/api/chroniclesdk"
	"github.com/Emyrk/chronicle/api/db2sdk"
	"github.com/Emyrk/chronicle/combatlog/consumers"
	"github.com/Emyrk/chronicle/combatlog/parser/sorter"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters"
	"github.com/Emyrk/chronicle/database"
	"github.com/Emyrk/chronicle/database/dbstatic"
	"github.com/Emyrk/chronicle/internal/leveledlog"
	"github.com/google/uuid"
	"github.com/riverqueue/river"
	"github.com/riverqueue/river/rivertype"
)

const KindLogParse = "log-parse"

type OutputLogParse struct {
	InstanceFailures map[string]string
}

type ArgsLogParse struct {
	LogID uuid.UUID `json:"log_group_id"`
}

func (ArgsLogParse) InsertOpts() river.InsertOpts {
	return river.InsertOpts{
		Queue:       QueueLogParsing,
		Priority:    PriorityDefault,
		MaxAttempts: 5,
		UniqueOpts: river.UniqueOpts{
			ByArgs: true,
			ByState: []rivertype.JobState{
				rivertype.JobStateScheduled,
				rivertype.JobStatePending,
				rivertype.JobStateAvailable,
				rivertype.JobStateRunning,
				rivertype.JobStateRetryable,
			},
		},
	}
}

func (a ArgsLogParse) Kind() string { return KindLogParse }

type WorkerLogParse struct {
	parent *Chronicle

	river.WorkerDefaults[ArgsLogParse]
}

func (w *WorkerLogParse) loadAndSortFile(ctx context.Context, fileID uuid.UUID) (io.Reader, error) {
	storage := w.parent.Storage
	logger := leveledlog.New(w.parent.logger, slog.LevelInfo)

	fd, err := storage.DownloadFile(BucketRaidLogs, w.parent.logPath(fileID))
	if err != nil {
		err = fmt.Errorf("download log file %s: %w", fileID, err)
		if errors.Is(err, os.ErrNotExist) {
			err = river.JobCancel(err)
		}
		return nil, err
	}

	fileData := &bytes.Buffer{}
	_, err = sorter.SortLogs(ctx, logger, bytes.NewReader(fd), fileData)
	if err != nil {
		return nil, fmt.Errorf("sort log file %s: %w", fileID, err)
	}

	// Help GC
	//nolint:ineffassign
	fd = nil

	return fileData, nil
}

func (w *WorkerLogParse) Work(ctx context.Context, job *river.Job[ArgsLogParse]) error {
	db := w.parent.DB

	files, err := db.GetWoWLogFilesByGroupID(ctx, job.Args.LogID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			w.parent.logger.Warn("log parse job for non-existent log group", "log_id", job.Args.LogID)

			return nil
		}

		return fmt.Errorf("fetch log group: %w", err)
	}

	if len(files) != 2 {
		return river.JobCancel(fmt.Errorf("log group does not have exactly 2 files, has %d", len(files)))
	}

	logger := leveledlog.New(w.parent.logger, slog.LevelInfo)
	rdrs := make([]io.Reader, len(files))
	for i, file := range files {
		rdrs[i], err = w.loadAndSortFile(ctx, file.ID)
		if err != nil {
			return err
		}
	}

	m := vanilla.Merger(logger)
	liner, scan, err := m.LineScanner(ctx, rdrs[0], rdrs[1])
	if err != nil {
		return fmt.Errorf("create line scanner: %w", err)
	}

	p := vanilla.NewFromScanner(logger, liner, scan)
	output := encounters.New(logger)
	c := consumers.New(logger, output)
	err = c.ConsumeAll(ctx, p)
	if err != nil {
		err = fmt.Errorf("consume log: %w", err)
		if !errors.Is(err, context.Canceled) {
			err = river.JobCancel(err)
		}
		return err
	}

	jobOut := chroniclesdk.WoWParsedLogJobOutput{
		InstanceFailures: make(map[string]string),
		Instances:        make([]chroniclesdk.WoWParsedInstance, 0),
	}

	err = db.InsertParsedLogGroup(ctx, job.Args.LogID)
	if err != nil {
		return river.JobCancel(fmt.Errorf("insert parsed log group: %w", err))
	}

	for i, inst := range output.Instances {
		encs, err := inst.Finalize(ctx)
		if err != nil {
			jobOut.InstanceFailures[fmt.Sprintf("%s_%d", inst.Name(), i)] = err.Error()
			continue
		}

		err = db.InTx(func(tx database.Store) error {
			dbinstance, err := tx.InsertInstance(ctx, database.InsertInstanceParams{
				ID: uuid.New(),
				// TODO: Detect this from the logs
				RealmID:    dbstatic.RealmAmbershire(),
				LogGroupID: job.Args.LogID,
				Name:       inst.Name(),
			})
			if err != nil {
				return fmt.Errorf("insert instance: %w", err)
			}

			// Store the encounters into the database
			sdkEncounters := make([]chroniclesdk.WoWEncounter, 0, len(encs))
			for _, enc := range encs {
				dbencounter, err := tx.InsertEncounter(ctx, database.InsertEncounterParams{
					ID:         uuid.New(),
					InstanceID: dbinstance.ID,
					Name:       enc.Name,
					Kill:       enc.IsKill,
					Boss:       enc.Boss,
					StartTime:  database.Timestamptz(enc.Combat.Start),
					EndTime:    database.Timestamptz(enc.Combat.End),
				})
				if err != nil {
					return fmt.Errorf("insert encounter: %w", err)
				}

				sdkEncounters = append(sdkEncounters, db2sdk.WoWEncounter(dbencounter))
			}

			jobOut.Instances = append(jobOut.Instances, chroniclesdk.WoWParsedInstance{
				WoWInstance: db2sdk.WoWInstance(dbinstance),
				Encounters:  sdkEncounters,
			})

			return nil
		}, nil)
		if err != nil {
			return river.JobCancel(fmt.Errorf("insert finalized encounters: %w", err))
		}
	}

	slices.SortFunc(jobOut.Instances, func(a, b chroniclesdk.WoWParsedInstance) int {
		if len(a.Encounters) == 0 && len(b.Encounters) == 0 {
			return strings.Compare(a.Name, b.Name)
		}
		if len(a.Encounters) == 0 {
			return 1
		}
		if len(b.Encounters) == 0 {
			return -1
		}
		return int(a.Encounters[0].StartTime.Unix() - b.Encounters[0].StartTime.Unix())
	})
	_ = river.RecordOutput(ctx, jobOut)

	return nil
}

func (w *WorkerLogParse) NextRetry(job *river.Job[ArgsLogParse]) time.Time {
	next := (&river.DefaultClientRetryPolicy{}).NextRetry(job.JobRow)
	return next.Add(time.Second * 60) // Make it a little slower to retry.
}

func (c *Chronicle) EnqueueParseLog(ctx context.Context, log database.WoWLogGroup) (*rivertype.JobInsertResult, error) {
	res, err := c.queue.Insert(ctx, ArgsLogParse{
		LogID: log.ID,
	}, &river.InsertOpts{
		Tags: []string{
			fmt.Sprintf("owner_%s", log.Owner.String()),
		},
	})

	return res, err
}
