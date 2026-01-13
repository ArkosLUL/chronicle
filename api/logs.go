package api

import (
	"net/http"

	"github.com/Emyrk/chronicle/api/chronauth"
	"github.com/Emyrk/chronicle/api/chroniclesdk"
	"github.com/Emyrk/chronicle/api/db2sdk"
	"github.com/Emyrk/chronicle/api/httpapi"
	"github.com/Emyrk/chronicle/internal/slice"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func (api *API) WoWLogGroups(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	uc := chronauth.MustAuthenticatedClaims(ctx)

	groups, err := api.Opts.DB.GetWoWLogGroupsByOwner(ctx, uc.Subject)
	if err != nil {
		httpapi.HandleResponseError(ctx, w, err, httpapi.APIError{
			Response: chroniclesdk.Response{
				Message: "Internal server error",
				Detail:  err.Error(),
			},
			Status:  http.StatusInternalServerError,
			Wrapped: err,
		})
		return
	}

	httpapi.Write(ctx, w, http.StatusOK, slice.List(groups, db2sdk.WoWLogGroupRow))
}

func (api *API) WoWLogGroup(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	logIDStr := chi.URLParam(r, "logID")
	logID, err := uuid.Parse(logIDStr)
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
			Message: "Invalid log ID format",
			Detail:  err.Error(),
		})
		return
	}

	resp, err := api.Chronicle.WoWLogGroup(ctx, logID)
	if err != nil {
		httpapi.HandleResponseError(ctx, w, err, httpapi.APIError{
			Response: chroniclesdk.Response{
				Message: "Internal server error",
				Detail:  err.Error(),
			},
			Status:  http.StatusInternalServerError,
			Wrapped: err,
		})
		return
	}

	httpapi.Write(ctx, w, http.StatusOK, resp)
}

func (api *API) WoWLogDeleteGroup(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	logIDStr := chi.URLParam(r, "logID")
	logID, err := uuid.Parse(logIDStr)
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
			Message: "Invalid log ID format",
			Detail:  err.Error(),
		})
		return
	}

	err = api.Chronicle.DeleteWoWLogGroup(ctx, logID)
	if err != nil {
		httpapi.HandleResponseError(ctx, w, err, httpapi.APIError{
			Response: chroniclesdk.Response{
				Message: "Failed to delete log group",
				Detail:  err.Error(),
			},
			Status: http.StatusInternalServerError,
		})
	}
	httpapi.Write(ctx, w, http.StatusNoContent, nil)
}
