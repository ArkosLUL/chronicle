package api

import (
	"fmt"
	"mime/multipart"
	"net/http"
	"strings"

	"github.com/Emyrk/chronicle/api/chronauth"
	"github.com/Emyrk/chronicle/api/chronauth/claims"
	"github.com/Emyrk/chronicle/api/chroniclesdk"
	"github.com/Emyrk/chronicle/api/httpapi"
	"github.com/Emyrk/chronicle/api/httpmw"
	"github.com/Emyrk/chronicle/chronicle"
	"github.com/Emyrk/chronicle/database"
	"github.com/Emyrk/chronicle/database/authz"
	"github.com/Emyrk/chronicle/database/authz/policy"
	"github.com/Emyrk/chronicle/internal/services"
	"github.com/google/uuid"
)

// ServiceAccountID is the well-known UUID for the chronicle-service user
// created by migration 000082. Used for server-side log uploads.
var ServiceAccountID = uuid.MustParse("8e3cd4a1-a9f6-4190-8de5-ef037e534981")

const MaxLogFileSize = 250 * 1024 * 1024 // 250 MB

func (api *API) WoWLogReparse(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	logID := httpmw.LogID(ctx)
	actor, _ := authz.ActorFromContext(ctx)

	ok, err := api.Zed.CheckOne(ctx, nil, policy.New().Raid_log(logID).CanReparse_User(actor))
	if err != nil || !ok {
		httpapi.Forbidden(w, err)
		return
	}

	files, err := api.Zed.GetWoWLogFilesByGroupID(ctx, logID)
	if err != nil {
		httpapi.HandleResponseError(ctx, w, err, httpapi.APIError{
			Response: chroniclesdk.Response{
				Message: "Failed to locate log files for re-parse",
				Detail:  err.Error(),
			},
			Status: http.StatusInternalServerError,
		})

		return
	}

	for _, f := range files {
		if f.StorageDeletedAt.Valid {
			httpapi.HandleResponseError(ctx, w, err, httpapi.APIError{
				Response: chroniclesdk.Response{
					Message: fmt.Sprintf("Log files were deleted at %s, cannot re-parse", f.StorageDeletedAt.Time),
					Detail:  "re-parse requires the log files to be present in storage",
				},
				Status: http.StatusBadRequest,
			})

			return
		}
	}

	verbose := r.URL.Query().Get("verbose") == "true"
	identityMode := r.URL.Query().Get("identity_mode") == "true"
	if identityMode {
		idActor, _ := authz.ActorFromContext(ctx)
		isAdmin, adminErr := api.Zed.CheckOne(ctx, nil, policy.New().GlobalChronicle().CanAdmin_logs_User(idActor))
		if adminErr != nil || !isAdmin {
			httpapi.Write(ctx, w, http.StatusForbidden, chroniclesdk.Response{
				Message: "Only admins can use identity mode",
			})
			return
		}
	}

	// Admin override: allow changing the log_type before reparsing.
	if override := r.URL.Query().Get("log_type"); override != "" {
		overrideType := database.LogType(override)
		if !overrideType.Valid() {
			httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
				Message: "Invalid log_type override",
				Detail:  fmt.Sprintf("unknown log type: %q", override),
			})
			return
		}
		ltActor, _ := authz.ActorFromContext(ctx)
		isAdmin, adminErr := api.Zed.CheckOne(ctx, nil, policy.New().GlobalChronicle().CanAdmin_logs_User(ltActor))
		if adminErr != nil || !isAdmin {
			httpapi.Write(ctx, w, http.StatusForbidden, chroniclesdk.Response{
				Message: "Only admins can override the log type",
			})
			return
		}
		err := api.Zed.UpdateWoWLogGroupLogType(ctx, database.UpdateWoWLogGroupLogTypeParams{
			ID:      logID,
			LogType: overrideType,
		})
		if err != nil {
			httpapi.InternalServerError(w, err)
			return
		}
	}

	res, err := api.Chronicle.EnqueueReParseLog(ctx, logID, verbose, identityMode)
	if err != nil {
		httpapi.HandleResponseError(ctx, w, err, httpapi.APIError{
			Response: chroniclesdk.Response{
				Message: "Failed to enqueue log re-parse",
				Detail:  err.Error(),
			},
			Status: http.StatusInternalServerError,
		})

		return
	}

	httpapi.Write(ctx, w, http.StatusAccepted, res.Job.ID)
}

func (api *API) DeleteWoWLogFiles(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	logID := httpmw.LogID(ctx)
	actor, _ := authz.ActorFromContext(ctx)

	ok, err := api.Zed.CheckOne(ctx, nil, policy.New().Raid_log(logID).CanDelete_files_User(actor))
	if err != nil || !ok {
		httpapi.Forbidden(w, err)
		return
	}

	err = api.Chronicle.DeleteWoWLogGroupFiles(ctx, logID)
	if err != nil {
		httpapi.HandleResponseError(ctx, w, err, httpapi.APIError{
			Response: chroniclesdk.Response{
				Message: "Failed to delete log files",
				Detail:  err.Error(),
			},
			Status: http.StatusInternalServerError,
		})
		return
	}

	httpapi.Write(ctx, w, http.StatusOK, chroniclesdk.Response{
		Message: "Log files deleted successfully",
	})
}

func (api *API) WoWLogUpload(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	//uc := chronauth.MustAuthenticatedClaims(ctx)

	first, firstHeader, err := r.FormFile("combat_log_1")
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
			Message: "Failed to get first file from form",
			Detail:  err.Error(),
		})
		return
	}
	defer func() { _ = first.Close() }()

	if firstHeader.Size > MaxLogFileSize {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
			Message: "First log file is too large, exceeds maximum allowed size of 250 MB",
			Detail:  fmt.Sprintf("file size: %d bytes", firstHeader.Size),
		})
		return
	}

	second, secondHeader, err := r.FormFile("combat_log_2")
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
			Message: "Failed to get second file from form",
			Detail:  err.Error(),
		})
		return
	}
	defer func() { _ = second.Close() }()

	if secondHeader.Size > MaxLogFileSize {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
			Message: "Second log file is too large, exceeds maximum allowed size of 250 MB",
			Detail:  fmt.Sprintf("file size: %d bytes", secondHeader.Size),
		})
		return
	}

	// Create upload inputs, detecting if files are gzip-compressed
	firstInput := chronicle.UploadInput{
		Reader:    first,
		IsGzipped: isGzipped(firstHeader),
	}
	secondInput := chronicle.UploadInput{
		Reader:    second,
		IsGzipped: isGzipped(secondHeader),
	}

	group, files, err := api.Chronicle.UploadLogs(ctx, []chronicle.UploadInput{firstInput, secondInput}, database.LogTypeV1)
	if err != nil {
		httpapi.HandleResponseError(ctx, w, err, httpapi.APIError{
			Response: chroniclesdk.Response{
				Message: "Failed to process uploaded log files",
				Detail:  err.Error(),
			},
			Status: http.StatusInternalServerError,
		})
		return
	}

	fileIDs := make([]uuid.UUID, 0, len(files))
	for _, f := range files {
		fileIDs = append(fileIDs, f.ID)
	}

	httpapi.Write(ctx, w, http.StatusCreated, chroniclesdk.LogUploadResponse{
		LogID: group.ID,
		Files: fileIDs,
	})
}

// isGzipped checks if a file header indicates gzip compression
func isGzipped(header *multipart.FileHeader) bool {
	return strings.HasSuffix(header.Filename, ".gz") ||
		header.Header.Get("Content-Type") == "application/gzip"
}

// WoWLogUploadV2 handles single-file uploads for parserv2 logs.
func (api *API) WoWLogUploadV2(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	file, header, err := r.FormFile("combat_log")
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
			Message: "Failed to get file from form",
			Detail:  err.Error(),
		})
		return
	}
	defer func() { _ = file.Close() }()

	if header.Size > MaxLogFileSize {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
			Message: "Log file is too large, exceeds maximum allowed size of 250 MB",
			Detail:  fmt.Sprintf("file size: %d bytes", header.Size),
		})
		return
	}

	input := chronicle.UploadInput{
		Reader:    file,
		IsGzipped: isGzipped(header),
	}

	logType := database.LogTypeV2
	switch services.ServerName {
	case services.ServerIdentityWarmane:
		logType = database.LogTypeWarmane
	case services.ServerIdentityEpoch:
		logType = database.LogTypeEpoch
	case services.ServerIdentityKronos:
		logType = database.LogTypeKronos
	}

	// Admin override: allow specifying log_type via query parameter.
	if override := r.URL.Query().Get("log_type"); override != "" {
		overrideType := database.LogType(override)
		if !overrideType.Valid() {
			httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
				Message: "Invalid log_type override",
				Detail:  fmt.Sprintf("unknown log type: %q", override),
			})
			return
		}
		actor, _ := authz.ActorFromContext(ctx)
		ok, err := api.Zed.CheckOne(ctx, nil, policy.New().GlobalChronicle().CanAdmin_logs_User(actor))
		if err != nil || !ok {
			httpapi.Write(ctx, w, http.StatusForbidden, chroniclesdk.Response{
				Message: "Only admins can override the log type",
			})
			return
		}
		logType = overrideType
	}

	group, files, err := api.Chronicle.UploadLogs(ctx, []chronicle.UploadInput{input}, logType)
	if err != nil {
		httpapi.HandleResponseError(ctx, w, err, httpapi.APIError{
			Response: chroniclesdk.Response{
				Message: "Failed to process uploaded log file",
				Detail:  err.Error(),
			},
			Status: http.StatusInternalServerError,
		})
		return
	}

	fileIDs := make([]uuid.UUID, 0, len(files))
	for _, f := range files {
		fileIDs = append(fileIDs, f.ID)
	}

	httpapi.Write(ctx, w, http.StatusCreated, chroniclesdk.LogUploadResponse{
		LogID: group.ID,
		Files: fileIDs,
	})
}

// ServerLogUpload handles log uploads from AzerothCore mod-chronicle.
// Authenticated via shared-secret bearer token, not session auth.
func (api *API) ServerLogUpload(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	secret := api.Opts.ServerUploadSecret
	if secret == "" {
		httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{
			Message: "Server uploads are not configured",
		})
		return
	}

	auth := r.Header.Get("Authorization")
	if auth != "Bearer "+secret {
		httpapi.Write(ctx, w, http.StatusUnauthorized, chroniclesdk.Response{
			Message: "Invalid authorization",
		})
		return
	}

	// Inject the well-known service account as the authenticated user
	// so UploadLogs can look up the owner and check storage limits.
	ctx = chronauth.WithClaims(ctx, &claims.Claims{
		Subject: ServiceAccountID,
	})
	ctx = authz.AsUser(ctx, ServiceAccountID)

	// Extract server metadata from headers for log merging
	instanceID := r.Header.Get("X-Chronicle-Instance-Id")
	instanceName := r.Header.Get("X-Chronicle-Instance-Name")
	realmName := r.Header.Get("X-Chronicle-Realm-Name")

	file, header, err := r.FormFile("combat_log")
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
			Message: "Failed to get file from form",
			Detail:  err.Error(),
		})
		return
	}
	defer func() { _ = file.Close() }()

	if header.Size > MaxLogFileSize {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
			Message: "Log file is too large, exceeds maximum allowed size of 250 MB",
			Detail:  fmt.Sprintf("file size: %d bytes", header.Size),
		})
		return
	}

	// Check for an existing log group with matching instance metadata.
	// If found, append to the existing file (multistream gzip concatenation)
	// and trigger a reparse. This merges logs from raid/dungeon breaks.
	if instanceID != "" && instanceName != "" { // Realmname is not working
		existing, findErr := api.Zed.FindMatchingServerUpload(ctx, database.FindMatchingServerUploadParams{
			Owner:        ServiceAccountID,
			InstanceID:   instanceID,
			InstanceName: instanceName,
			RealmName:    realmName,
		})
		if findErr == nil {
			// Append to existing group
			if appendErr := api.Chronicle.AppendServerLog(ctx, existing, file); appendErr != nil {
				httpapi.Write(ctx, w, http.StatusInternalServerError, chroniclesdk.Response{
					Message: "Failed to append log to existing group",
					Detail:  appendErr.Error(),
				})
				return
			}

			existingFiles, _ := api.Zed.GetWoWLogFilesByGroupID(ctx, existing.ID)
			fileIDs := make([]uuid.UUID, 0, len(existingFiles))
			for _, f := range existingFiles {
				fileIDs = append(fileIDs, f.ID)
			}

			api.Opts.Logger.Info("Appended server log to existing group",
				"log_group_id", existing.ID,
				"instance_id", instanceID,
				"instance_name", instanceName,
			)
			httpapi.Write(ctx, w, http.StatusCreated, chroniclesdk.LogUploadResponse{
				LogID: existing.ID,
				Files: fileIDs,
			})
			return
		}
	}

	// No matching group found — normal upload flow
	input := chronicle.UploadInput{
		Reader:    file,
		IsGzipped: isGzipped(header),
	}

	group, files, err := api.Chronicle.UploadLogs(ctx, []chronicle.UploadInput{input}, database.LogTypeAzerothcore)
	if err != nil {
		httpapi.HandleResponseError(ctx, w, err, httpapi.APIError{
			Response: chroniclesdk.Response{
				Message: "Failed to process uploaded log file",
				Detail:  err.Error(),
			},
			Status: http.StatusInternalServerError,
		})
		return
	}

	fileIDs := make([]uuid.UUID, 0, len(files))
	for _, f := range files {
		fileIDs = append(fileIDs, f.ID)
	}

	// Store server metadata for future append matching
	if instanceID != "" && instanceName != "" { // realmName may be empty until configured
		if metaErr := api.Zed.InsertServerUploadMeta(ctx, database.InsertServerUploadMetaParams{
			LogGroupID:   group.ID,
			InstanceID:   instanceID,
			InstanceName: instanceName,
			RealmName:    realmName,
		}); metaErr != nil {
			api.Opts.Logger.Warn("Failed to store server upload metadata",
				"error", metaErr,
				"log_group_id", group.ID,
			)
		}
	}

	api.Opts.Logger.Info("Received server log upload",
		"log_group_id", group.ID,
		"instance_id", instanceID,
		"instance_name", instanceName,
	)
	httpapi.Write(ctx, w, http.StatusCreated, chroniclesdk.LogUploadResponse{
		LogID: group.ID,
		Files: fileIDs,
	})
}
