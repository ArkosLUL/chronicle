package api

import (
	"context"
	"fmt"
	"log/slog"
	"net/url"

	"github.com/Emyrk/chronicle/api/chronauth"
	"github.com/Emyrk/chronicle/api/httpmw"
	"github.com/Emyrk/chronicle/chronicle"
	"github.com/Emyrk/chronicle/database"
	"github.com/Emyrk/chronicle/database/raidlogs"
	"github.com/Emyrk/chronicle/database/storage"
	"github.com/Emyrk/chronicle/frontend"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
	context2 "github.com/gorilla/context"
	"github.com/prometheus/client_golang/prometheus"
)

type Options struct {
	Logger     *slog.Logger
	Storage    storage.ObjectStorage
	DB         database.Store
	Registry   *prometheus.Registry
	AccessURL  *url.URL
	DevOAuth   bool
	Discord    chronauth.DiscordOAuth
	SecretPEM  []byte // Used for JWTs
	RiverQueue chronicle.RiverQueueOptions
}

type API struct {
	AppContext context.Context
	Opts       *Options
	Auth       *chronauth.Service
	Chronicle  *chronicle.Chronicle
}

func New(ctx context.Context, opts Options) (*API, error) {
	if opts.Registry == nil {
		opts.Registry = prometheus.NewRegistry()
	}
	service, err := chronauth.New(ctx, opts.Logger, chronauth.Options{
		AccessURL: opts.AccessURL,
		DevServer: opts.DevOAuth,
		Database:  opts.DB,
		Discord:   opts.Discord,
		Sessions: chronauth.SessionOptions{
			SecretPEM: opts.SecretPEM,
			Registry:  opts.Registry,
		},
	})
	if err != nil {
		return nil, err
	}

	rw, err := raidlogs.NewRaidLogStorage(opts.Logger, opts.DB, opts.Storage)
	if err != nil {
		return nil, fmt.Errorf("raidlog storage: %w", err)
	}

	chr, err := chronicle.New(ctx, opts.Logger, chronicle.Options{
		RaidLogs: rw,
		DB:       opts.DB,
	})
	if err != nil {
		return nil, fmt.Errorf("chronicle: %w", err)
	}

	return &API{
		Opts:       &opts,
		AppContext: ctx,
		Auth:       service,
		Chronicle:  chr,
	}, nil
}

func (api *API) Routes() chi.Router {
	r := chi.NewRouter()
	r.Use(
		httpmw.Recover(api.Opts.Logger),
		context2.ClearHandler,
		// TODO: Finish cors options
		cors.Handler(cors.Options{}),
		httpmw.NoWWW(),
		httpmw.PrometheusMW(api.Opts.Registry),
	)

	r.Route("/api/v1", func(r chi.Router) {
		r.Use(
		//authMW.Trace,
		)

		r.Group(func(r chi.Router) {
			r.Use(api.Auth.Authenticated(false))
			r.Get("/whoami", api.WhoAmI)
			r.Route("/raidlogs", func(r chi.Router) {
				r.Post("/upload", api.WoWLogUpload)
			})
		})
	})

	// Auth routes
	r.Mount("/auth", api.Auth.Handler())
	r.NotFound(frontend.Handler(frontend.FS()).ServeHTTP)

	return r
}
