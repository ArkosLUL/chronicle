package httpmw

import (
	"context"
	"net/http"

	"github.com/Emyrk/chronicle/api/httpapi"
	"github.com/go-pkgz/auth/v2/token"
)

type chronicleUserCtxKey struct{}

func User(r *http.Request) token.User {
	return r.Context().Value(chronicleUserCtxKey{}).(token.User)
}

func Authenticated(srv *token.Service) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			usr, err := token.GetUserInfo(r)
			if err != nil {
				srv.Reset(w)
				httpapi.Write(r.Context(), w, http.StatusUnauthorized, err)
				return
			}

			ctx := r.Context()
			context.WithValue(ctx, chronicleUserCtxKey{}, usr)

			next.ServeHTTP(w, r.WithContext(context.WithValue(ctx, chronicleUserCtxKey{}, usr)))
		})
	}
}
