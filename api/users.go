package api

import (
	"net/http"

	"github.com/Emyrk/chronicle/api/chronauth"
	"github.com/Emyrk/chronicle/api/chroniclesdk"
	"github.com/Emyrk/chronicle/api/httpapi"
	"github.com/google/uuid"
)

func (a *API) WhoAmI(w http.ResponseWriter, r *http.Request) {
	state := chronauth.AuthenticationState(r)
	ctx := r.Context()
	roles, err := a.Zed.UserChronicleRoles(ctx, state.Claims.Subject)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	// Fetch user storage info
	user, err := a.Opts.DB.GetUserByID(ctx, state.Claims.Subject)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	httpapi.Write(r.Context(), w, http.StatusOK, chroniclesdk.Session{
		UserID:               state.Claims.Subject,
		SessionID:            state.Claims.SessionID,
		Roles:                roles,
		MaxStorageBytes:      user.MaxStorageBytes.Int64,
		ConsumedStorageBytes: user.ConsumedStorageBytes,
		Preferences: chroniclesdk.Preferences{
			HelpfulHints: user.ID == uuid.MustParse("4d977ff0-45a8-4673-967a-b148c771413f"),
		},
	})
}
