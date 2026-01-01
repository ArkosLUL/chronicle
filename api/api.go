package api

import (
	"context"
	"fmt"
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
	"github.com/markbates/goth"
	"github.com/markbates/goth/gothic"
	"github.com/prometheus/client_golang/prometheus"
)

type Options struct {
	DB        database.Store
	Logger    *slog.Logger
	Registry  *prometheus.Registry
	AccessURL *url.URL
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
	var _ = service
	//authMW := service.Middleware()

	r := chi.NewRouter()
	r.Use(
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
	r.Route("/auth", func(r chi.Router) {
		for _, p := range goth.GetProviders() {
			r.Get(fmt.Sprintf("/%s/callback", p.Name()), func(w http.ResponseWriter, r *http.Request) {
				user, err := gothic.CompleteUserAuth(w, r)
				if err != nil {
					http.Error(w, err.Error(), http.StatusInternalServerError)
					return
				}

				fmt.Println(user)
				httpapi.Write(r.Context(), w, http.StatusOK, user)
			})
		}

		r.Get("/list", func(w http.ResponseWriter, r *http.Request) {
			arr := []string{}
			for _, p := range goth.GetProviders() {
				arr = append(arr, p.Name())
			}
			httpapi.Write(r.Context(), w, http.StatusOK, arr)
		})
	})
	r.NotFound(frontend.Handler(frontend.FS()).ServeHTTP)

	return r
}
