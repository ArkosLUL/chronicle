package api

import (
	"net/http"

	"github.com/Emyrk/chronicle/api/chroniclesdk"
	"github.com/Emyrk/chronicle/api/db2sdk"
	"github.com/Emyrk/chronicle/api/httpapi"
	"github.com/Emyrk/chronicle/api/httpmw"
	"github.com/Emyrk/chronicle/internal/slice"
)

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

	httpapi.Write(ctx, w, http.StatusOK, db2sdk.WowInstanceWithEncounters(inst, encounters))
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
		})
		return
	}

	httpapi.Write(ctx, w, http.StatusOK, slice.List(damage, db2sdk.EncounterDamageSummary))
}
