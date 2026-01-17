package httpmw

import (
	"context"
	"net/http"

	"github.com/Emyrk/chronicle/api/chroniclesdk"
	"github.com/Emyrk/chronicle/api/httpapi"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type instanceIDKey struct{}

func InstanceID(ctx context.Context) uuid.UUID {
	id, _ := ctx.Value(instanceIDKey{}).(uuid.UUID)
	return id
}

func InstanceIDMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		instanceIDStr := chi.URLParam(r, "instance_id")
		instanceID, err := uuid.Parse(instanceIDStr)
		if err != nil {
			httpapi.Write(r.Context(), w, http.StatusBadRequest, chroniclesdk.Response{
				Message: "Invalid instance ID format",
				Detail:  err.Error(),
			})
			return
		}

		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), instanceIDKey{}, instanceID)))
	})
}
