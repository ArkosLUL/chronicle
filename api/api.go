package api

import (
	"context"

	"github.com/Emyrk/chronicle/api/httpmw"
	"github.com/go-chi/chi/v5"
	"github.com/prometheus/client_golang/prometheus"
)

type Options struct {
	Registry *prometheus.Registry
}

type API struct {
	Opts *Options
}

func New(ctx context.Context, opts Options) (*API, error) {
	if opts.Registry == nil {
		opts.Registry = prometheus.NewRegistry()
	}
	return &API{
		Opts: &opts,
	}, nil
}

func (api *API) Routes() chi.Router {
	r := chi.NewRouter()
	r.Use(
		httpmw.NoWWW(),
		httpmw.PrometheusMW(api.Opts.Registry),
	)

	return r
}
