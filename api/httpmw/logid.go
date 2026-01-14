package httpmw

import (
	"context"
	"net/http"

	"github.com/Emyrk/chronicle/api/chroniclesdk"
	"github.com/Emyrk/chronicle/api/httpapi"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type logIDKey struct{}

func LogID(ctx context.Context) uuid.UUID {
	id, _ := ctx.Value(logIDKey{}).(uuid.UUID)
	return id
}

func LogIDMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		logIDStr := chi.URLParam(r, "logID")
		logID, err := uuid.Parse(logIDStr)
		if err != nil {
			httpapi.Write(r.Context(), w, http.StatusBadRequest, chroniclesdk.Response{
				Message: "Invalid log ID format",
				Detail:  err.Error(),
			})
			return
		}

		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), logIDKey{}, logID)))
	})
}
