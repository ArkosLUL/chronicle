package chronicle

import (
	"context"
	"fmt"

	"github.com/Emyrk/chronicle/chronicle/worker"
	"github.com/Emyrk/chronicle/database"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"
)

type RiverQueueOptions struct {
	DBURL      string
	InsertOnly bool
}

func (c *Chronicle) StartQueues(ctx context.Context, opts Options) error {
	cfg, err := database.PoolConfig(c.logger, opts.Queue.DBURL)
	if err != nil {
		return fmt.Errorf("db url for queues: %w", err)
	}

	// Pool changes
	cfg.MaxConns = 2 // Smaller pool for background workers

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return fmt.Errorf("new pool: %w", err)
	}

	riverClient, err := river.NewClient(riverpgxv5.New(pool), &river.Config{
		Queues:  c.queues(opts.Queue),
		Workers: c.workers(),
	})
	if err != nil {
		return fmt.Errorf("new river client: %w", err)
	}
	c.queue = riverClient

	err = riverClient.Start(ctx)
	if err != nil {
		return fmt.Errorf("start river client: %w", err)
	}

	return nil
}

func (c *Chronicle) queues(opts RiverQueueOptions) map[string]river.QueueConfig {
	if opts.InsertOnly {
		return nil
	}
	return map[string]river.QueueConfig{
		river.QueueDefault: {MaxWorkers: 5},
	}
}

func (c *Chronicle) workers() *river.Workers {
	workers := river.NewWorkers()

	river.AddWorker(workers, &worker.WorkerLogParse{})
	return workers
}
