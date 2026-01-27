package api

import (
	"net/http"

	"github.com/Emyrk/chronicle/api/chroniclesdk"
	"github.com/Emyrk/chronicle/api/db2sdk"
	"github.com/Emyrk/chronicle/api/httpapi"
	"github.com/Emyrk/chronicle/api/httpmw"
	"github.com/Emyrk/chronicle/database"
	"github.com/Emyrk/chronicle/internal/slice"
)

func (api *API) InstanceEvents(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	instanceID := httpmw.InstanceID(ctx)
	db := api.Opts.DB

	types := r.URL.Query().Get("types")
	if types == "" {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
			Message: "Query param 'types' is required",
		})
		return
	}

	evts, err := db.InstanceEncounterEvents(ctx, database.InstanceEncounterEventsParams{
		InstanceID: instanceID,
		Types:      []database.LogInstanceEncounterEventType{database.LogInstanceEncounterEventTypeDamage}, //slice.StringEnums[database.LogInstanceEncounterEventType](strings.Split(types, ",")),
	})
	if err != nil {
		httpapi.HandleResponseError(ctx, w, err, httpapi.APIError{
			Response: chroniclesdk.Response{
				Message: "Failed to fetch instance encounter events",
				Detail:  err.Error(),
			},
		})
		return
	}

	// The conversion to another type is pretty expensive, just use the type as is
	httpapi.Write(ctx, w, http.StatusOK, evts)
}

func (api *API) Instance(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	instanceID := httpmw.InstanceID(ctx)

	db := api.Opts.DB
	inst, err := db.Instance(ctx, instanceID)
	if err != nil {
		httpapi.HandleResponseError(ctx, w, err, httpapi.APIError{
			Response: chroniclesdk.Response{
				Message: "Failed to fetch instance",
				Detail:  err.Error(),
			},
			Status: http.StatusInternalServerError,
		})
		return
	}

	encounters, err := db.EncountersByInstanceID(ctx, instanceID)
	if err != nil {
		httpapi.HandleResponseError(ctx, w, err, httpapi.APIError{
			Response: chroniclesdk.Response{
				Message: "Failed to fetch encounters for instance",
				Detail:  err.Error(),
			},
		})
		return
	}

	units, err := db.InstanceUnitsByInstanceID(ctx, instanceID)
	if err != nil {
		httpapi.HandleResponseError(ctx, w, err, httpapi.APIError{
			Response: chroniclesdk.Response{
				Message: "Failed to fetch instance units",
				Detail:  err.Error(),
			},
		})
		return
	}

	players, err := db.InstancePlayersByInstanceID(ctx, instanceID)
	if err != nil {
		httpapi.HandleResponseError(ctx, w, err, httpapi.APIError{
			Response: chroniclesdk.Response{
				Message: "Failed to fetch instance players",
				Detail:  err.Error(),
			},
		})
		return
	}

	fights, err := db.GetInstanceEncounterCharacterFights(ctx, instanceID)
	if err != nil {
		httpapi.HandleResponseError(ctx, w, err, httpapi.APIError{
			Response: chroniclesdk.Response{
				Message: "Failed to fetch instance encounter character fights",
				Detail:  err.Error(),
			},
		})
		return
	}

	httpapi.Write(ctx, w, http.StatusOK, db2sdk.WowDecoratedInstance(inst, units, players, encounters, fights))
}

func (api *API) InstanceDamageSummaries(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	instanceID := httpmw.InstanceID(ctx)

	damage, err := api.Opts.DB.DamageSummariesByInstanceID(ctx, instanceID)
	if err != nil {
		httpapi.HandleResponseError(ctx, w, err, httpapi.APIError{
			Response: chroniclesdk.Response{
				Message: "Failed to fetch damage summaries for instance",
				Detail:  err.Error(),
			},
			Status: http.StatusInternalServerError,
		})
		return
	}

	httpapi.Write(ctx, w, http.StatusOK, slice.List(damage, db2sdk.EncounterDamageSummary))
}
