package api

import (
	"net/http"

	"github.com/Emyrk/chronicle/internal/services/servicetenant"
	"github.com/go-chi/cors"
)

func Cors(tenant *servicetenant.Service) func(next http.Handler) http.Handler {
	return cors.Handler(cors.Options{
		AllowOriginFunc: func(_ *http.Request, origin string) bool {
			return tenant.IsAllowedOrigin(origin)
		},
		AllowedMethods:   []string{"OPTIONS", "GET"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           300,
	})
}
