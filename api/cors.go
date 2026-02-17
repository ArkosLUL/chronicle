package api

import (
	"net/http"
	"net/url"
	"strings"

	"github.com/go-chi/cors"
)

func Cors(accessURL *url.URL) func(next http.Handler) http.Handler {
	if strings.Contains(accessURL.Host, "localhost") {
		return func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				next.ServeHTTP(w, r)
			})
		}
	}

	return cors.Handler(cors.Options{
		AllowedOrigins: []string{},
		AllowedMethods: []string{},
	})
}
