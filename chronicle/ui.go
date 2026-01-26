package chronicle

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/Emyrk/chronicle/api/chronauth"
	"github.com/Emyrk/chronicle/internal/leveledlog"
	"riverqueue.com/riverui"
)

func (c *Chronicle) RiverUI() http.Handler {
	return c.riverUI
}

func (c *Chronicle) webUI(ctx context.Context) (http.Handler, error) {
	endpoints := riverui.NewEndpoints(c.queue, nil)

	// Drop debug logs
	logger := c.logger.With(slog.String("server", "river_ui"))
	logger = leveledlog.New(logger, slog.LevelInfo)

	opts := &riverui.HandlerOpts{
		DevMode:                  false,
		Endpoints:                endpoints,
		JobListHideArgsByDefault: false,
		LiveFS:                   false,
		Logger:                   logger,
		Prefix:                   "/river",
	}

	srv, err := riverui.NewHandler(opts)
	if err != nil {
		return nil, fmt.Errorf("new handler: %w", err)
	}

	err = srv.Start(ctx)
	if err != nil {
		return nil, fmt.Errorf("start riverui server: %w", err)
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		uc := chronauth.MustAuthenticatedClaims(r.Context())
		// TODO: Check if administrator
		var _ = uc

		srv.ServeHTTP(w, r)
	}), nil
}
