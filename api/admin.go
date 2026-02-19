package api

import (
	"net/http"
	"strconv"
	"time"

	"github.com/Emyrk/chronicle/api/chroniclesdk"
	"github.com/Emyrk/chronicle/api/db2sdk"
	"github.com/Emyrk/chronicle/api/httpapi"
	"github.com/Emyrk/chronicle/database"
	"github.com/Emyrk/chronicle/database/authz"
	"github.com/Emyrk/chronicle/database/authz/policy"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

// AdminListUsers returns all users in the system.
// @Summary List all users
// @Tags Admin
// @Success 200 {object} chroniclesdk.AdminUsersResponse
// @Router /api/v1/admin/users [get]
func (a *API) AdminListUsers(w http.ResponseWriter, r *http.Request) {
	users, err := a.Opts.Zed.ListAllUsers(r.Context())
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	resp := chroniclesdk.AdminUsersResponse{
		Users: make([]chroniclesdk.User, len(users)),
	}
	for i, u := range users {
		roles, err := a.Opts.Zed.UserChronicleRoles(r.Context(), u.ID)
		if err != nil {
			httpapi.InternalServerError(w, err)
			return
		}

		resp.Users[i] = db2sdk.User(u, roles)
	}

	httpapi.Write(r.Context(), w, http.StatusOK, resp)
}

// SetUserDataLimit updates a user's storage limit.
// @Summary Set user data limit
// @Tags Admin
// @Param userID path string true "User ID"
// @Param request body chroniclesdk.SetUserDataLimitRequest true "New storage limit"
// @Success 200 {object} chroniclesdk.User
// @Router /api/v1/admin/users/{userID}/data-limit [put]
func (a *API) SetUserDataLimit(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userIDStr := chi.URLParam(r, "userID")

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
			Message: "Invalid user ID",
			Detail:  err.Error(),
		})
		return
	}

	actor, _ := authz.ActorFromContext(ctx)
	b := policy.New()

	ok, err := a.Zed.CheckOne(ctx, nil, b.GlobalChronicle().CanSet_user_data_limit_User(actor))
	if err != nil || !ok {
		httpapi.Forbidden(w, err)
		return
	}

	var req chroniclesdk.SetUserDataLimitRequest
	if !httpapi.Read(ctx, w, r, &req) {
		return
	}

	_, err = a.Opts.Zed.SetUserStorageLimit(ctx, database.SetUserStorageLimitParams{
		UserID:          userID,
		MaxStorageBytes: req.MaxStorageBytes,
		UpdatedAt:       pgtype.Timestamptz{Time: time.Now(), Valid: true},
	})
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	// Fetch updated user to return
	user, err := a.Opts.Zed.GetUserByID(ctx, userID)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	roles, err := a.Opts.Zed.UserChronicleRoles(ctx, userID)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	httpapi.Write(ctx, w, http.StatusOK, db2sdk.User(user, roles))
}

// AdminResyncUserRoles re-syncs a user's primary roles from Discord.
// @Summary Resync user roles from Discord
// @Tags Admin
// @Param userID path string true "User ID"
// @Success 200 {object} chroniclesdk.User
// @Router /api/v1/admin/users/{userID}/resync [post]
func (a *API) AdminResyncUserRoles(w http.ResponseWriter, r *http.Request) {
	userIDStr := chi.URLParam(r, "userID")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		httpapi.Write(r.Context(), w, http.StatusBadRequest, map[string]string{
			"message": "Invalid user ID",
		})
		return
	}

	// Get the user's Discord link
	link, err := a.Opts.Zed.GetUserAuthLinkByUserID(r.Context(), userID)
	if err != nil {
		httpapi.Write(r.Context(), w, http.StatusNotFound, map[string]string{
			"message": "User has no linked Discord account",
		})
		return
	}

	if link.Provider != "discord" {
		httpapi.Write(r.Context(), w, http.StatusBadRequest, map[string]string{
			"message": "User is not linked via Discord",
		})
		return
	}

	// Resync via bot
	if a.Opts.Bot == nil {
		httpapi.Write(r.Context(), w, http.StatusServiceUnavailable, map[string]string{
			"message": "Discord bot not configured",
		})
		return
	}

	err = a.Opts.Bot.SyncDiscordUser(r.Context(), a.Opts.Zed, link.LinkedID, userID)
	if err != nil {
		httpapi.Write(r.Context(), w, http.StatusInternalServerError, map[string]string{
			"message": "Failed to sync user roles: " + err.Error(),
		})
		return
	}

	// Fetch updated user
	user, err := a.Opts.Zed.GetUserByID(r.Context(), userID)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	roles, err := a.Opts.Zed.UserChronicleRoles(r.Context(), userID)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	httpapi.Write(r.Context(), w, http.StatusOK, db2sdk.User(user, roles))
}

const (
	defaultAdminLogsLimit = 50
	maxAdminLogsLimit     = 100
)

// AdminListLogs returns all logs in the system with pagination, sorting, and filtering.
// @Summary List all logs
// @Tags Admin
// @Param limit query int false "Number of results per page (default 50, max 100)"
// @Param offset query int false "Offset for pagination"
// @Param sort_by query string false "Sort field: date, user, size, instance (default: date)"
// @Param sort_order query string false "Sort order: asc, desc (default: desc)"
// @Param user_id query string false "Filter by user ID (UUID)"
// @Param instance_name query string false "Filter by instance name"
// @Success 200 {object} chroniclesdk.AdminLogsResponse
// @Router /api/v1/admin/logs [get]
func (a *API) AdminListLogs(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Parse limit
	limit := defaultAdminLogsLimit
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}
	if limit > maxAdminLogsLimit {
		limit = maxAdminLogsLimit
	}

	// Parse offset
	offset := 0
	if o := r.URL.Query().Get("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	// Parse sort_by with allowlist validation
	sortBy := r.URL.Query().Get("sort_by")
	if sortBy == "" {
		sortBy = "date"
	}
	if sortBy != "date" && sortBy != "user" && sortBy != "size" && sortBy != "instance" {
		sortBy = "date"
	}

	// Parse sort_order with allowlist validation
	sortOrder := r.URL.Query().Get("sort_order")
	if sortOrder == "" {
		sortOrder = "desc"
	}
	if sortOrder != "asc" && sortOrder != "desc" {
		sortOrder = "desc"
	}

	// Parse filter parameters
	filterUserID := uuid.Nil
	if userIDStr := r.URL.Query().Get("user_id"); userIDStr != "" {
		if parsed, err := uuid.Parse(userIDStr); err == nil {
			filterUserID = parsed
		}
	}
	filterInstanceName := r.URL.Query().Get("instance_name")

	// Fetch total count for pagination (with filters applied)
	totalCount, err := a.Opts.Zed.CountAllWoWLogGroups(ctx, database.CountAllWoWLogGroupsParams{
		FilterUserID:       filterUserID,
		FilterInstanceName: filterInstanceName,
	})
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	// Fetch logs with +1 to detect hasMore
	logs, err := a.Opts.Zed.ListAllWoWLogGroupsWithOwnerPaginated(ctx, database.ListAllWoWLogGroupsWithOwnerPaginatedParams{
		FilterUserID:       filterUserID,
		FilterInstanceName: filterInstanceName,
		SortBy:             sortBy,
		SortOrder:          sortOrder,
		LimitCount:         int32(limit + 1),
		OffsetCount:        int32(offset),
	})
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	// Determine hasMore
	hasMore := len(logs) > limit
	if hasMore {
		logs = logs[:limit]
	}

	resp := chroniclesdk.AdminLogsResponse{
		Logs:       make([]chroniclesdk.AdminLog, len(logs)),
		HasMore:    hasMore,
		TotalCount: int(totalCount),
	}

	for i, l := range logs {
		state := "unknown"
		if l.ProcessingOutput != nil {
			state = "processed"
		}

		ownerName := ""
		if l.OwnerName.Valid {
			ownerName = l.OwnerName.String
		}

		// Extract total size from interface{}
		var sizeBytes int64
		if l.TotalSizeBytes != nil {
			switch v := l.TotalSizeBytes.(type) {
			case int64:
				sizeBytes = v
			case float64:
				sizeBytes = int64(v)
			}
		}

		// Extract instance names from interface{}
		var instanceNames []string
		if l.InstanceNames != nil {
			if names, ok := l.InstanceNames.([]interface{}); ok {
				for _, n := range names {
					if s, ok := n.(string); ok {
						instanceNames = append(instanceNames, s)
					}
				}
			}
		}
		if instanceNames == nil {
			instanceNames = []string{}
		}

		resp.Logs[i] = chroniclesdk.AdminLog{
			ID:            l.WoWLogGroup.ID,
			OwnerID:       l.WoWLogGroup.Owner,
			OwnerName:     ownerName,
			Description:   "",
			CreatedAt:     l.WoWLogGroup.CreatedAt.Time.Format("2006-01-02T15:04:05Z"),
			State:         state,
			SizeBytes:     sizeBytes,
			InstanceNames: instanceNames,
		}
	}

	httpapi.Write(ctx, w, http.StatusOK, resp)
}

// AdminListInstanceNames returns all distinct instance names for filtering.
// @Summary List all instance names
// @Tags Admin
// @Success 200 {array} string
// @Router /api/v1/admin/instance-names [get]
func (a *API) AdminListInstanceNames(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	names, err := a.Opts.Zed.ListDistinctInstanceNames(ctx)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	// Ensure we return an empty array, not null
	if names == nil {
		names = []string{}
	}

	httpapi.Write(ctx, w, http.StatusOK, names)
}
