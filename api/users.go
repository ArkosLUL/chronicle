package api

import (
	"net/http"

	"github.com/Emyrk/chronicle/api/chronauth"
	"github.com/Emyrk/chronicle/api/chroniclesdk"
	"github.com/Emyrk/chronicle/api/httpapi"
	"github.com/Emyrk/chronicle/database"
)

func (a *API) WhoAmI(w http.ResponseWriter, r *http.Request) {
	state := chronauth.AuthenticationState(r)

	user, err := a.Opts.DB.GetUserByID(r.Context(), state.Claims.Subject)
	if err != nil {
		httpapi.Write(r.Context(), w, http.StatusOK, chroniclesdk.Session{
			UserID:    state.Claims.Subject,
			SessionID: state.Claims.SessionID,
			Roles:     []chroniclesdk.UserRole{},
		})
		return
	}

	httpapi.Write(r.Context(), w, http.StatusOK, chroniclesdk.Session{
		UserID:    state.Claims.Subject,
		SessionID: state.Claims.SessionID,
		Roles:     dbRolesToSDK(user.Roles),
	})
}

func dbRolesToSDK(roles []database.UserRoles) []chroniclesdk.UserRole {
	result := make([]chroniclesdk.UserRole, len(roles))
	for i, r := range roles {
		result[i] = chroniclesdk.UserRole(r)
	}
	return result
}
