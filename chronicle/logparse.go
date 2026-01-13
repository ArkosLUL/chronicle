package chronicle

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/Emyrk/chronicle/database"
	"github.com/google/uuid"
	"github.com/riverqueue/river"
	"github.com/riverqueue/river/rivertype"
)

const KindLogParse = "log-parse"

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
