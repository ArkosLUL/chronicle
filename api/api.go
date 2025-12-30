package api

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/Emyrk/chronicle/api/chronauth"
	"github.com/Emyrk/chronicle/api/httpapi"
	"github.com/Emyrk/chronicle/api/httpmw"
	"github.com/Emyrk/chronicle/database"
	"github.com/Emyrk/chronicle/frontend"
	"github.com/go-chi/chi/v5"
	"github.com/go-pkgz/auth/v2/token"
	"github.com/prometheus/client_golang/prometheus"
)

type Options struct {
	DB        database.Store
	Logger    *slog.Logger
	Registry  *prometheus.Registry
	AccessURL string
	DevOAuth  bool
	Discord   chronauth.DiscordOAuth
}

type API struct {
	Opts       *Options
	AppContext context.Context
}

func New(ctx context.Context, opts Options) (*API, error) {
	if opts.Registry == nil {
		opts.Registry = prometheus.NewRegistry()
	}
	return &API{
		Opts:       &opts,
		AppContext: ctx,
	}, nil
}

func (api *API) Routes() chi.Router {
	service := chronauth.Service(api.AppContext, api.Opts.Logger, chronauth.Options{
		AccessURL: api.Opts.AccessURL,
		DevServer: api.Opts.DevOAuth,
		Database:  api.Opts.DB,
		Discord:   api.Opts.Discord,
	})
	authMW := service.Middleware()

	r := chi.NewRouter()
	r.Use(
		httpmw.NoWWW(),
		httpmw.PrometheusMW(api.Opts.Registry),
	)

	r.Route("/api/v1", func(r chi.Router) {
		r.Use(
			authMW.Trace,
		)

		r.Group(func(r chi.Router) {
			r.Use(httpmw.Authenticated(service.TokenService()))

			r.Get("/whoami", api.WhoAmI)
		})
	})

	r.With(authMW.Auth).Get("/private", func(w http.ResponseWriter, r *http.Request) {
		usr, err := token.GetUserInfo(r)
		if err != nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		httpapi.Write(r.Context(), w, http.StatusOK, usr)
	})

	// Auth routes
	authRoutes, avaRoutes := service.Handlers()
	r.Mount("/auth", authRoutes)
	r.Mount("/ava", avaRoutes)
	r.NotFound(frontend.Handler(frontend.FS()).ServeHTTP)

	return r
}
