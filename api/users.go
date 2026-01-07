package api

import (
	"net/http"

	"github.com/Emyrk/chronicle/api/chronauth"
	"github.com/Emyrk/chronicle/api/httpapi"
	"github.com/Emyrk/chronicle/api/sdk"
)

func (a *API) WhoAmI(w http.ResponseWriter, r *http.Request) {
	c, ok := chronauth.AuthenticatedClaims(r.Context())
	if !ok {
		httpapi.Write(r.Context(), w, http.StatusUnauthorized, "not authenticated")
		return
	}
	if c == nil {
		httpapi.Write(r.Context(), w, http.StatusUnauthorized, "not authenticated")
		return
	}

	httpapi.Write(r.Context(), w, http.StatusOK, sdk.Session{
		UserID:    c.Subject,
		SessionID: c.ID,
	})
}
