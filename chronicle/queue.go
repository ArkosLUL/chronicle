package chronicle

import (
	"context"
	"fmt"

	"github.com/Emyrk/chronicle/database"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"
	"github.com/riverqueue/river/rivermigrate"
)

const (
	QueueLogParsing = "log-parsing"
)

const (
	PriorityHighest = 1
	PriorityHigh    = 2
	PriorityDefault = 3
	PriorityLow     = 4
)

type RiverQueueOptions struct {
	DBURL             string
	InsertOnly        bool
	LogParsingWorkers int64
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

	driver := riverpgxv5.New(pool)

	migrator, err := rivermigrate.New(driver, nil)
	if err != nil {
		return fmt.Errorf("new river migrator: %w", err)
	}

	_, err = migrator.Migrate(ctx, rivermigrate.DirectionUp, nil)
	if err != nil {
		return fmt.Errorf("migrate river queues: %w", err)
	}

	riverClient, err := river.NewClient(driver, &river.Config{
		Queues:  c.queues(opts.Queue),
		Workers: c.workers(opts.Queue),
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
		QueueLogParsing:    {MaxWorkers: int(opts.LogParsingWorkers)},
	}
}

func (c *Chronicle) workers(opts RiverQueueOptions) *river.Workers {
	workers := river.NewWorkers()

	if opts.LogParsingWorkers > 0 {
		river.AddWorker(workers, &WorkerLogParse{
			parent: c,
		})
	}

	return workers
}
