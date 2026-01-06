package api

import (
	"net/http"

	"github.com/Emyrk/chronicle/api/httpapi"
	"github.com/Emyrk/chronicle/api/sdk"
)

func (a *API) WhoAmI(w http.ResponseWriter, r *http.Request) {
	session, ok := a.Auth.Authenticated(w, r)
	if !ok {
		return
	}
	if session == nil {
		httpapi.Write(r.Context(), w, http.StatusUnauthorized, "not authenticated")
		return
	}

	httpapi.Write(r.Context(), w, http.StatusOK, sdk.Session{
		UserID:    session.Subject,
		SessionID: session.ID,
	})
}
