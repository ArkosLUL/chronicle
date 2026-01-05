package api

import (
	"context"
	"log/slog"
	"net/http"
	"net/url"

	"github.com/Emyrk/chronicle/api/chronauth"
	"github.com/Emyrk/chronicle/api/httpapi"
	"github.com/Emyrk/chronicle/api/httpmw"
	"github.com/Emyrk/chronicle/database"
	"github.com/Emyrk/chronicle/frontend"
	"github.com/go-chi/chi/v5"
	"github.com/go-pkgz/auth/v2/token"
	context2 "github.com/gorilla/context"
	"github.com/prometheus/client_golang/prometheus"
)

type Options struct {
	DB        database.Store
	Logger    *slog.Logger
	Registry  *prometheus.Registry
	AccessURL *url.URL
	DevOAuth  bool
	Discord   chronauth.DiscordOAuth
	SecretPEM []byte // Used for JWTs
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
	service := chronauth.New(api.AppContext, api.Opts.Logger, chronauth.Options{
		AccessURL: api.Opts.AccessURL,
		DevServer: api.Opts.DevOAuth,
		Database:  api.Opts.DB,
		Discord:   api.Opts.Discord,
		Sessions: chronauth.SessionOptions{
			SecretPEM: api.Opts.SecretPEM,
			Registry:  api.Opts.Registry,
		},
	})

	r := chi.NewRouter()
	r.Use(
		context2.ClearHandler,
		httpmw.NoWWW(),
		httpmw.PrometheusMW(api.Opts.Registry),
	)

	r.Route("/api/v1", func(r chi.Router) {
		r.Use(
		//authMW.Trace,
		)

		r.Group(func(r chi.Router) {
			//r.Use(httpmw.Authenticated(service.TokenService()))

			r.Get("/whoami", api.WhoAmI)
		})
	})

	r.With(). //authMW.Auth).
			Get("/private", func(w http.ResponseWriter, r *http.Request) {
			usr, err := token.GetUserInfo(r)
			if err != nil {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}
			httpapi.Write(r.Context(), w, http.StatusOK, usr)
		})

	// Auth routes
	r.Mount("/auth", service.Handler())
	r.NotFound(frontend.Handler(frontend.FS()).ServeHTTP)

	return r
}
