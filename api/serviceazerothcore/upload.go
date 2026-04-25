package serviceazerothcore

import (
	"context"
	"fmt"
	"mime/multipart"
	"net/http"
	"strings"

	"github.com/Emyrk/chronicle/api/chronauth"
	"github.com/Emyrk/chronicle/api/chronauth/claims"
	"github.com/Emyrk/chronicle/api/chroniclesdk"
	"github.com/Emyrk/chronicle/api/httpapi"
	"github.com/Emyrk/chronicle/chronicle"
	"github.com/Emyrk/chronicle/database"
	"github.com/Emyrk/chronicle/database/authz"
	"github.com/Emyrk/chronicle/database/authz/policy"
	"github.com/google/uuid"
)

const MaxLogFileSize = 250 * 1024 * 1024 // 250 MB

// authenticateUploadKey extracts the Bearer token from the request, looks up
// the upload key by hash, and checks SpiceDB upload permission on the realm.
// On failure it writes the appropriate HTTP error and returns false.
func (h *Handler) authenticateUploadKey(ctx context.Context, w http.ResponseWriter, r *http.Request) (database.GetUploadKeyByHashRow, bool) {
	bearer := r.Header.Get("Authorization")
	token := strings.TrimPrefix(bearer, "Bearer ")
	if token == "" || token == bearer {
		httpapi.Write(ctx, w, http.StatusUnauthorized, chroniclesdk.Response{
			Message: "Missing or invalid Authorization header",
		})
		return database.GetUploadKeyByHashRow{}, false
	}

	tokenHash := hashToken(token)
	key, err := h.zed.GetUploadKeyByHash(ctx, tokenHash)
	if err != nil {
		httpapi.Write(ctx, w, http.StatusUnauthorized, chroniclesdk.Response{
			Message: "Invalid upload key",
		})
		return database.GetUploadKeyByHashRow{}, false
	}

	b := policy.New()
	can, err := h.zed.CheckOne(ctx, nil,
		b.Wow_server_realm(key.RealmID).CanUpload_log_Wow_server_upload_key(b.Wow_server_upload_key(key.ID)),
	)
	if err != nil || !can {
		httpapi.Write(ctx, w, http.StatusForbidden, chroniclesdk.Response{
			Message: "Upload key does not have permission",
		})
		return database.GetUploadKeyByHashRow{}, false
	}

	return key, true
}

func (h *Handler) Ping(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	key, ok := h.authenticateUploadKey(ctx, w, r)
	if !ok {
		return
	}

	realm, err := h.zed.GetWoWServerRealm(ctx, key.RealmID)
	if err != nil {
		httpapi.Write(ctx, w, http.StatusInternalServerError, chroniclesdk.Response{
			Message: "Failed to look up realm",
		})
		return
	}

	httpapi.Write(ctx, w, http.StatusOK, chroniclesdk.AzerothCorePingResponse{
		RealmName: realm.Name,
		Status:    "ok",
	})
}

// ServerLogUpload handles log uploads from AzerothCore mod-chronicle.
// Authenticated via per-realm upload key (Bearer token looked up from DB).
func (h *Handler) ServerLogUpload(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	key, ok := h.authenticateUploadKey(ctx, w, r)
	if !ok {
		return
	}

	// Touch last_used_at in the background
	go func() { _ = h.zed.TouchUploadKeyLastUsed(context.Background(), key.ID) }()

	// Inject the well-known service account as the authenticated user
	// so UploadLogs can look up the owner and check storage limits.
	ctx = chronauth.WithClaims(ctx, &claims.Claims{
		Subject: ServiceAccountID,
	})
	ctx = authz.AsUser(ctx, ServiceAccountID)

	// Extract server metadata from headers for log merging
	instanceID := r.Header.Get("X-Chronicle-Instance-Id")
	instanceName := r.Header.Get("X-Chronicle-Instance-Name")
	realmID := uuid.NullUUID{UUID: key.RealmID, Valid: key.RealmID != uuid.Nil}

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

	if instanceID == "" || instanceName == "" {
		// Check for an existing log group with matching instance metadata.
		// If found, append to the existing file (multistream gzip concatenation)
		// and trigger a reparse. This merges logs from raid/dungeon breaks.
		existing, findErr := h.zed.FindMatchingServerUpload(ctx, database.FindMatchingServerUploadParams{
			Owner:        ServiceAccountID,
			InstanceID:   instanceID,
			InstanceName: instanceName,
			RealmID:      realmID,
		})
		if findErr == nil {
			// Append to existing group
			if appendErr := h.chronicle.AppendServerLog(ctx, existing, file, key.RealmID); appendErr != nil {
				httpapi.Write(ctx, w, http.StatusInternalServerError, chroniclesdk.Response{
					Message: "Failed to append log to existing group",
					Detail:  appendErr.Error(),
				})
				return
			}

			existingFiles, _ := h.zed.GetWoWLogFilesByGroupID(ctx, existing.ID)
			fileIDs := make([]uuid.UUID, 0, len(existingFiles))
			for _, f := range existingFiles {
				fileIDs = append(fileIDs, f.ID)
			}

			h.logger.Info("Appended server log to existing group",
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

	group, files, err := h.chronicle.UploadLogs(ctx, []chronicle.UploadInput{input}, database.LogTypeAzerothcore, key.RealmID)
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
	if metaErr := h.zed.InsertServerUploadMeta(ctx, database.InsertServerUploadMetaParams{
		LogGroupID:   group.ID,
		InstanceID:   instanceID,
		InstanceName: instanceName,
		RealmID:      realmID,
	}); metaErr != nil {
		h.logger.Warn("Failed to store server upload metadata",
			"error", metaErr,
			"log_group_id", group.ID,
		)
	}

	h.logger.Info("Received server log upload",
		"log_group_id", group.ID,
		"instance_id", instanceID,
		"instance_name", instanceName,
	)
	httpapi.Write(ctx, w, http.StatusCreated, chroniclesdk.LogUploadResponse{
		LogID: group.ID,
		Files: fileIDs,
	})
}

// isGzipped checks if a file header indicates gzip compression
// by examining content type and file extension.
func isGzipped(header *multipart.FileHeader) bool {
	ct := header.Header.Get("Content-Type")
	if strings.EqualFold(ct, "application/gzip") || strings.EqualFold(ct, "application/x-gzip") {
		return true
	}
	name := strings.ToLower(header.Filename)
	return strings.HasSuffix(name, ".gz") || strings.HasSuffix(name, ".gzip")
}
