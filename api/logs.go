package api

import (
	"net/http"
	"slices"

	"github.com/Emyrk/chronicle/api/chronauth"
	"github.com/Emyrk/chronicle/api/chroniclesdk"
	"github.com/Emyrk/chronicle/api/db2sdk"
	"github.com/Emyrk/chronicle/api/httpapi"
	"github.com/Emyrk/chronicle/api/httpmw"
	"github.com/Emyrk/chronicle/database"
	"github.com/Emyrk/chronicle/internal/slice"
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
	logID := httpmw.LogID(ctx)
	user, _ := chronauth.AuthenticatedUser(r.Context())

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

	canView := slices.Contains(user.Roles, database.UserRolesAdmin) ||
		slices.Contains(user.Roles, database.UserRolesTechnicalAdmin) ||
		resp.Owner == user.ID
	if !canView {
		httpapi.Write(ctx, w, http.StatusForbidden, chroniclesdk.Response{
			Message: "You do not have permission to view this log group",
		})
		return
	}

	httpapi.Write(ctx, w, http.StatusOK, resp)
}

func (api *API) WoWLogDeleteGroup(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	logID := httpmw.LogID(ctx)
	user, ok := chronauth.AuthenticatedUser(ctx)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	canDelete := slice.Contains(user.Roles, database.UserRolesAdmin) ||
		slice.Contains(user.Roles, database.UserRolesTechnicalAdmin)

	if !canDelete {
		group, err := api.Chronicle.WoWLogGroup(ctx, logID)
		if err != nil {
			httpapi.HandleResponseError(ctx, w, err, httpapi.APIError{
				Response: chroniclesdk.Response{
					Message: "Failed to fetch log group",
					Detail:  err.Error(),
				},
			})
			return
		}
		if group.Owner != user.ID {
			httpapi.Write(ctx, w, http.StatusForbidden, chroniclesdk.Response{
				Message: "You do not have permission to delete this log group",
			})
			return
		}
	}

	err := api.Chronicle.DeleteWoWLogGroup(ctx, logID)
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
