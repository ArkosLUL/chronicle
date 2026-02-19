package httpmw

import (
	"context"
	"net/http"

	"github.com/Emyrk/chronicle/api/chroniclesdk"
	"github.com/Emyrk/chronicle/api/httpapi"
	"github.com/Emyrk/chronicle/database"
	"github.com/Emyrk/chronicle/database/authz"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type guidIDKey struct{}

func Guild(ctx context.Context) database.GetGuildByIDRow {
	id, _ := ctx.Value(guidIDKey{}).(database.GetGuildByIDRow)
	return id
}

func GuildIDMiddleware(db *authz.Authz) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			guildIDStr := chi.URLParam(r, "guildID")
			guildID, err := uuid.Parse(guildIDStr)
			if err != nil {
				httpapi.Write(r.Context(), w, http.StatusBadRequest, chroniclesdk.Response{
					Message: "Invalid guild ID format",
					Detail:  err.Error(),
				})
				return
			}

			ctx := r.Context()
			guild, err := db.GetGuildByID(ctx, guildID)
			if err != nil {
				httpapi.HandleResponseError(ctx, w, err, httpapi.APIError{
					Response: chroniclesdk.Response{
						Message: "Failed to get guild",
						Detail:  err.Error(),
					},
					Status:  http.StatusInternalServerError,
					Wrapped: err,
				})
				return
			}

			next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), guidIDKey{}, guild)))
		})
	}
}
