package api

import (
	"fmt"
	"net/http"
	"path/filepath"
	"strconv"

	"github.com/Emyrk/chronicle/api/chronauth"
	"github.com/Emyrk/chronicle/api/chroniclesdk"
	"github.com/Emyrk/chronicle/api/db2sdk"
	"github.com/Emyrk/chronicle/api/httpapi"
	"github.com/Emyrk/chronicle/api/httpmw"
	"github.com/Emyrk/chronicle/chronicle"
	"github.com/Emyrk/chronicle/database/authz"
	"github.com/Emyrk/chronicle/database/authz/policy"
	"github.com/Emyrk/chronicle/internal/slice"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func (api *API) WoWLogGroups(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	uc := chronauth.MustAuthenticatedClaims(ctx)

	groups, err := api.Opts.Zed.GetWoWLogGroupsByOwner(ctx, uc.Subject)
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

func (api *API) WoWLogGroupByFile(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	fileHash := chi.URLParam(r, "file-hash")

	// Look up the log file by hash to get the log group ID
	file, err := api.Opts.Zed.GetFileByHash(ctx, fileHash)
	if err != nil {
		httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{
			Message: "Log file not found",
			Detail:  err.Error(),
		})
		return
	}

	logID := file.WowLogID
	actor, _ := authz.ActorFromContext(ctx)
	ok, err := api.Zed.CheckOne(ctx, nil, policy.New().Raid_log(logID).CanView_User(actor))
	if !ok || err != nil {
		httpapi.Forbidden(w, err)
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

func (api *API) WoWLogGroup(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	logID := httpmw.LogID(ctx)
	actor, _ := authz.ActorFromContext(ctx)
	ok, err := api.Zed.CheckOne(ctx, nil, policy.New().Raid_log(logID).CanView_User(actor))
	if !ok || err != nil {
		httpapi.Forbidden(w, err)
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
	logID := httpmw.LogID(ctx)
	actor, _ := authz.ActorFromContext(ctx)

	ok, err := api.Zed.CheckOne(ctx, nil, policy.New().Raid_log(logID).CanDelete_User(actor))
	if err != nil || !ok {
		httpapi.Forbidden(w, err)
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
func (api *API) WoWLogFileDownload(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	fileID, err := uuid.Parse(chi.URLParam(r, "fileID"))
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
			Message: "Invalid file ID",
		})
		return
	}

	actor, _ := authz.ActorFromContext(ctx)
	// Check admin_logs permission on global chronicle
	ok, err := api.Zed.CheckOne(ctx, nil, policy.New().GlobalChronicle().CanAdmin_logs_User(actor))
	if !ok || err != nil {
		httpapi.Forbidden(w, err)
		return
	}

	// Get file metadata
	file, err := api.Opts.Zed.GetLogFile(ctx, fileID)
	if err != nil {
		httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{
			Message: "File not found",
		})
		return
	}

	// Check if file is deleted from storage
	if file.StorageDeletedAt.Valid {
		httpapi.Write(ctx, w, http.StatusGone, chroniclesdk.Response{
			Message: "File has been deleted from storage",
		})
		return
	}

	// Download from storage
	contents, err := api.Chronicle.Storage.DownloadFile(ctx, chronicle.BucketRaidLogs,
		filepath.Join("logs", fileID.String()))
	if err != nil {
		httpapi.HandleResponseError(ctx, w, err, httpapi.APIError{
			Response: chroniclesdk.Response{
				Message: "Failed to download file from storage",
				Detail:  err.Error(),
			},
			Status:  http.StatusInternalServerError,
			Wrapped: err,
		})
		return
	}

	// Set headers for file download
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Content-Disposition",
		fmt.Sprintf("attachment; filename=\"combatlog-%s.txt\"", file.ID.String()))
	w.Header().Set("Content-Length", strconv.FormatInt(file.SizeBytes, 10))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(contents)
}
