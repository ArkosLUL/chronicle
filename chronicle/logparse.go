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
	"time"

	"github.com/Emyrk/chronicle/combatlog/consumers"
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

func (w *WorkerLogParse) Work(ctx context.Context, job *river.Job[ArgsLogParse]) error {
	db := w.parent.DB
	storage := w.parent.Storage

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

	rdrs := make([]io.Reader, 0, len(files))
	for _, file := range files {
		fd, err := storage.DownloadFile(BucketRaidLogs, w.parent.logPath(file.ID))
		if err != nil {
			err = fmt.Errorf("download log file %s: %w", file.ID, err)
			if errors.Is(err, os.ErrNotExist) {
				err = river.JobCancel(err)
			}
			return err
		}
		rdrs = append(rdrs, bytes.NewReader(fd))
	}

	logger := leveledlog.New(w.parent.logger, slog.LevelInfo)

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

	jobOut := OutputLogParse{
		InstanceFailures: make(map[string]string),
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
			var _ = encs
			for _, enc := range encs {
				dbencounter, err := tx.InsertEncounter(ctx, database.InsertEncounterParams{
					ID:         uuid.New(),
					InstanceID: dbinstance.ID,
					Name:       enc.Name,
					Kill:       enc.IsKill,
					StartTime:  database.Timestamptz(enc.Combat.Start),
					EndTime:    database.Timestamptz(enc.Combat.End),
				})
				if err != nil {
					return fmt.Errorf("insert encounter: %w", err)
				}

				var _ = dbencounter
			}

			return nil
		}, nil)
		if err != nil {
			return river.JobCancel(fmt.Errorf("insert finalized encounters: %w", err))
		}
	}
	_ = river.RecordOutput(ctx, jobOut)

	return nil
}

func (w *WorkerLogParse) save() {

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
