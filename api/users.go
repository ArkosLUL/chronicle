package api

import (
	"net/http"

	"github.com/Emyrk/chronicle/api/chronauth"
	"github.com/Emyrk/chronicle/api/httpapi"
	"github.com/Emyrk/chronicle/api/sdk"
)

func (a *API) WhoAmI(w http.ResponseWriter, r *http.Request) {
	state := chronauth.AuthenticationState(r)



	httpapi.Write(r.Context(), w, http.StatusOK, sdk.Session{
		UserID:    state.Claims.Subject,
		SessionID: state.Claims.SessionID,
	})
}
