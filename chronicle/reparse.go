package chronicle

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/riverqueue/river"
	"github.com/riverqueue/river/rivertype"
)

const KindLogReparse = "log-reparse"

type ArgsLogReparse struct {
	LogID uuid.UUID `json:"log_group_id"`
}

func (ArgsLogReparse) InsertOpts() river.InsertOpts {
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

func (a ArgsLogReparse) Kind() string { return KindLogReparse }

type WorkerLogReparse struct {
	parent *Chronicle

	river.WorkerDefaults[ArgsLogReparse]
}

func (w *WorkerLogReparse) Work(ctx context.Context, job *river.Job[ArgsLogReparse]) error {
	// Clear the parsed data for the log group and re-initiate parsing
	db := w.parent.DB

	logGroup, err := db.GetWoWLogGroupByID(ctx, job.Args.LogID)
	if err != nil {
		return fmt.Errorf("fetch log group: %w", err)
	}

	res, err := w.parent.EnqueueParseLog(ctx, logGroup.WoWLogGroup)
	if err != nil {
		return fmt.Errorf("enqueue log parse job: %w", err)
	}

	_ = river.RecordOutput(ctx, map[string]any{
		"reparse_job_id": res.Job.ID,
	})
	return nil
}

func (c *Chronicle) EnqueueReParseLog(ctx context.Context, logID uuid.UUID) (*rivertype.JobInsertResult, error) {
	res, err := c.queue.Insert(ctx, ArgsLogReparse{
		LogID: logID,
	}, &river.InsertOpts{
		Tags: []string{},
	})

	return res, err
}
