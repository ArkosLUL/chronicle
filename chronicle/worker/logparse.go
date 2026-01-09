package worker

import (
	"context"

	"github.com/riverqueue/river"
)

type ArgsLogParse struct {
}

func (a ArgsLogParse) Kind() string { return "log-parse" }

type WorkerLogParse struct {
	river.WorkerDefaults[ArgsLogParse]
}

func (w *WorkerLogParse) Work(ctx context.Context, job *river.Job[ArgsLogParse]) error {

	return nil
}
