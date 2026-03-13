package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/Emyrk/chronicle/api/chroniclesdk"
	"github.com/Emyrk/chronicle/api/db2sdk"
	"github.com/Emyrk/chronicle/api/httpapi"
	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/Emyrk/chronicle/database"
	"github.com/Emyrk/chronicle/database/dbstatic"
)

func (api *API) GetArmoryPlayer(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	realmParam := chi.URLParam(r, "realm")
	playerParam := chi.URLParam(r, "player")

	// Resolve realm: try UUID first, then static realm name lookup.
	realmID, err := uuid.Parse(realmParam)
	if err != nil {
		var ok bool
		realmID, ok = dbstatic.RealmByName(realmParam)
		if !ok {
			httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{
				Message: "Realm not found",
			})
			return
		}
	}

	// Resolve player: try GUID parse for the identifier field,
	// and always pass the raw string as the name fallback.
	var identifier guid.GUID
	if g, parseErr := guid.FromString(playerParam); parseErr == nil {
		identifier = g
	}

	player, err := api.Opts.Zed.GetGamePlayerByGUID(ctx, database.GetGamePlayerByGUIDParams{
		RealmID:    realmID,
		Identifier: identifier,
		Name:       playerParam,
	})
	if err != nil {
		httpapi.HandleResponseError(ctx, w, err, httpapi.APIError{
			Response: chroniclesdk.Response{
				Message: "Player not found",
			},
			Status: http.StatusNotFound,
		})
		return
	}

	httpapi.Write(ctx, w, http.StatusOK, db2sdk.ArmoryPlayer(player))
}
