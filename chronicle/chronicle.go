package chronicle

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/Emyrk/chronicle/api/chronauth"
	"github.com/Emyrk/chronicle/database"
	"github.com/Emyrk/chronicle/database/raidlogs"
)

type Chronicle struct {
	AppContext context.Context
	RaidLogs   *raidlogs.RaidLogStorage
	DB         database.Store
	logger     *slog.Logger
}

type Options struct {
	RaidLogs *raidlogs.RaidLogStorage
	DB       database.Store
}

func New(ctx context.Context, logger *slog.Logger, opts Options) (*Chronicle, error) {
	return &Chronicle{
		AppContext: ctx,
		RaidLogs:   opts.RaidLogs,
		DB:         opts.DB,
		logger:     logger,
	}, nil
}

func (c *Chronicle) UploadFile(ctx context.Context) error {
	cl, ok := chronauth.AuthenticatedClaims(ctx)
	if !ok {
		return fmt.Errorf("upload file, no authenticated user")
	}

	var _ = cl
	return nil
}
