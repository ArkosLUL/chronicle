package chronauth

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/Emyrk/chronicle/api/chronauth/claims"
)

type authenticatedKey struct{}

func AuthenticatedClaims(ctx context.Context) (*claims.Claims, bool) {
	v := ctx.Value(&authenticatedKey{})
	if v == nil {
		return nil, false
	}
	c, ok := v.(*claims.Claims)
	return c, ok
}

func WithClaims(ctx context.Context, c *claims.Claims) context.Context {
	return context.WithValue(ctx, authenticatedKey{}, c)
}

var (
	notAuthorized = errors.New("not authorized")
)

func (s *Service) Authenticated(optional bool) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			fail := func(err error) {
				if errors.Is(err, notAuthorized) {
					http.Error(w, err.Error(), http.StatusUnauthorized)
					return
				}
				http.Error(w, err.Error(), http.StatusInternalServerError)
			}

			if optional {
				fail = func(err error) {
					next.ServeHTTP(w, r)
				}
			}

			auth, err := s.Store.Get(r, AuthSessionName)
			if err != nil {
				// TODO: Error to try again
				_ = s.Logout(w, r)
				fail(err)
				return
			}

			jwt, ok := auth.Values["jwt"]
			if !ok {
				fail(notAuthorized)
				return
			}

			jwtStr, ok := jwt.(string)
			if !ok {
				// TODO: Error to try again
				_ = s.Logout(w, r)
				fail(notAuthorized)
				return
			}

			c, err := s.sessions.ValidateSession(jwtStr)
			if err != nil {
				// TODO: Error to try again
				_ = s.Logout(w, r)
				fail(fmt.Errorf("Invalid session (%s): %w", err.Error(), notAuthorized))
				return
			}

			next.ServeHTTP(w, r.WithContext(WithClaims(r.Context(), &c)))
		})
	}
}
