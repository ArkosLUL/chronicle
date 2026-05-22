package serviceapplication

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/Emyrk/chronicle/api/chronauth"
	"github.com/Emyrk/chronicle/api/chroniclesdk"
	"github.com/Emyrk/chronicle/api/httpapi"
	"github.com/Emyrk/chronicle/api/httpmw"
	"github.com/Emyrk/chronicle/chroniclebot"
	"github.com/Emyrk/chronicle/database"
	"github.com/Emyrk/chronicle/database/authz"
	"github.com/Emyrk/chronicle/database/authz/policy"
	"github.com/Emyrk/chronicle/internal/services/servicetenant"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
)

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

var validModTypes = map[string]bool{
	"core": true, "slug": true, "description": true,
	"logos": true, "theme": true, "server": true, "realm": true,
}

// requireApplicationAdminister checks wow_tenant_application#administer.
func (s *Service) requireApplicationAdminister(zed *authz.Authz) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()
			actor, ok := authz.ActorFromContext(ctx)
			if !ok {
				httpapi.Forbidden(w, nil)
				return
			}
			appID, err := uuid.Parse(chi.URLParam(r, "id"))
			if err != nil {
				httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "invalid application ID"})
				return
			}
			can, err := zed.CheckOne(ctx, nil, policy.New().Wow_tenant_application(appID).CanAdminister_User(actor))
			if err != nil {
				httpapi.InternalServerError(w, err)
				return
			}
			if !can {
				httpapi.Forbidden(w, nil)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// Routes returns the chi router for server application endpoints.
func (s *Service) Routes(zed *authz.Authz) http.Handler {
	r := chi.NewRouter()

	r.With(
		httpmw.Can(zed, policy.New().GlobalChronicle().CanCreate_tenant_application_User),
	).Post("/", s.Create)

	r.Get("/", s.GetMine)

	r.Route("/{id}", func(r chi.Router) {
		r.Use(s.requireApplicationAdminister(zed))

		r.Get("/", s.Get)
		r.Post("/requests", s.CreateRequest)
		r.Put("/requests/{reqID}", s.UpdateRequest)
		r.Delete("/requests/{reqID}", s.DeleteRequest)

		r.With(httpmw.Can(zed, policy.New().GlobalChronicle().CanAdmin_tenants_User)).Group(func(r chi.Router) {
			r.Post("/requests/{reqID}/approve", s.ApproveRequest)
			r.Post("/requests/{reqID}/reject", s.RejectRequest)
		})

		r.With(httpmw.Can(zed, policy.New().GlobalChronicle().CanAdmin_users_User)).Group(func(r chi.Router) {
			r.Get("/admins", s.ListApplicationAdmins)
			r.Post("/admins", s.AddApplicationAdmin)
			r.Delete("/admins/{userID}", s.RemoveApplicationAdmin)
		})
	})

	r.With(httpmw.Can(zed, policy.New().GlobalChronicle().CanAdmin_tenants_User)).
		Get("/all", s.List)

	return r
}

// Create creates a new application, auto-provisioning a tenant and initial mod requests.
func (s *Service) Create(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	actor, ok := authz.ActorFromContext(ctx)
	if !ok {
		httpapi.Forbidden(w, nil)
		return
	}
	claims := chronauth.MustAuthenticatedClaims(r.Context())
	userID := claims.Subject

	var req chroniclesdk.CreateServerApplicationRequest
	if !httpapi.Read(ctx, w, r, &req) {
		return
	}

	if req.Name == "" || req.DisplayName == "" {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "name and display_name are required"})
		return
	}
	if len(req.Servers) == 0 {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "at least one server is required"})
		return
	}
	for i, srv := range req.Servers {
		if srv.Name == "" {
			httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: fmt.Sprintf("servers[%d].name is required", i)})
			return
		}
		if len(srv.Realms) == 0 {
			httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: fmt.Sprintf("servers[%d] must have at least one realm", i)})
			return
		}
	}

	// Create tenant (non-discoverable, branding empty — populated via approved mod requests).
	bypassCtx := servicetenant.AdminBypass(ctx)
	tenantID := uuid.New()
	_, err := s.Zed.InsertTenant(bypassCtx, database.InsertTenantParams{
		ID:           tenantID,
		Name:         req.Name,
		IncludeInAll: false,
		Discoverable: false,
	})
	if err != nil {
		if isUniqueViolation(err) {
			httpapi.Write(ctx, w, http.StatusConflict, chroniclesdk.Response{
				Message: fmt.Sprintf("A server with the name %q already exists.", req.Name),
			})
			return
		}
		httpapi.InternalServerError(w, fmt.Errorf("create tenant: %w", err))
		return
	}
	s.Tenant.InvalidateCache()

	appID := uuid.New()
	_, err = s.Zed.InsertServerApplication(bypassCtx, database.InsertServerApplicationParams{
		ID:          appID,
		InitiatedBy: userID,
		Name:        req.Name,
		TenantID:    tenantID,
	})
	if err != nil {
		httpapi.InternalServerError(w, fmt.Errorf("create application: %w", err))
		return
	}

	// Create initial mod requests: core + servers + realms.
	corePayload, _ := json.Marshal(chroniclesdk.CorePayload{
		Name:        req.Name,
		DisplayName: req.DisplayName,
		Tagline:     req.Tagline,
		Tags:        req.Tags,
	})
	_, err = s.DB.InsertModificationRequest(ctx, database.InsertModificationRequestParams{
		ID: uuid.New(), ApplicationID: appID, Type: "core", Payload: corePayload,
	})
	if err != nil {
		httpapi.InternalServerError(w, fmt.Errorf("create core request: %w", err))
		return
	}

	for _, srv := range req.Servers {
		srvPayload, _ := json.Marshal(chroniclesdk.ServerPayload{
			Name: srv.Name, Description: srv.Description, URL: srv.URL,
		})
		srvReq, err := s.DB.InsertModificationRequest(ctx, database.InsertModificationRequestParams{
			ID: uuid.New(), ApplicationID: appID, Type: "server", Payload: srvPayload,
		})
		if err != nil {
			httpapi.InternalServerError(w, fmt.Errorf("create server request: %w", err))
			return
		}
		for _, realm := range srv.Realms {
			realmPayload, _ := json.Marshal(chroniclesdk.RealmPayload(realm))
			_, err := s.DB.InsertModificationRequest(ctx, database.InsertModificationRequestParams{
				ID:            uuid.New(),
				ApplicationID: appID,
				Type:          "realm",
				ParentID:      uuid.NullUUID{UUID: srvReq.ID, Valid: true},
				Payload:       realmPayload,
			})
			if err != nil {
				httpapi.InternalServerError(w, fmt.Errorf("create realm request: %w", err))
				return
			}
		}
	}

	// Discord notification.
	if s.Queue != nil {
		user, _ := s.DB.GetUserByID(ctx, userID)
		applicantName := user.Username
		if applicantName == "" {
			applicantName = "Unknown"
		}
		_, _ = s.Queue.Insert(ctx, chroniclebot.ArgsNotifyApplication{
			ApplicationID: appID.String(),
			Name:          req.Name,
			Applicant:     applicantName,
			Tagline:       req.Tagline,
			ReviewURL:     fmt.Sprintf("%s/apply/%s", s.accessURL, appID),
			ChannelID:     s.applicationsChannelID,
		}, nil)
	}

	resp, err := s.buildApplicationResponse(ctx, appID, actor)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}
	httpapi.Write(ctx, w, http.StatusCreated, resp)
}

// GetMine returns all applications the current user can administer.
func (s *Service) GetMine(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	claims := chronauth.MustAuthenticatedClaims(ctx)
	actor, ok := authz.ActorFromContext(ctx)
	if !ok {
		httpapi.Forbidden(w, nil)
		return
	}

	appIDs, err := s.Zed.UserTenantApplications(ctx, claims.Subject)
	if err != nil {
		httpapi.InternalServerError(w, fmt.Errorf("lookup user applications: %w", err))
		return
	}
	if len(appIDs) == 0 {
		httpapi.Write(ctx, w, http.StatusOK, []chroniclesdk.ServerApplication{})
		return
	}

	apps := make([]chroniclesdk.ServerApplication, 0, len(appIDs))
	for _, appID := range appIDs {
		resp, err := s.buildApplicationResponse(ctx, appID, actor)
		if err != nil {
			continue
		}
		apps = append(apps, resp)
	}
	httpapi.Write(ctx, w, http.StatusOK, apps)
}

// Get returns an application by ID.
func (s *Service) Get(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	actor, ok := authz.ActorFromContext(ctx)
	if !ok {
		httpapi.Forbidden(w, nil)
		return
	}

	appID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "invalid application ID"})
		return
	}

	resp, err := s.buildApplicationResponse(ctx, appID, actor)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}
	httpapi.Write(ctx, w, http.StatusOK, resp)
}

// List returns all applications (admin only).
func (s *Service) List(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	rows, err := s.DB.ListServerApplications(ctx)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	out := make([]chroniclesdk.ServerApplication, 0, len(rows))
	for _, row := range rows {
		out = append(out, chroniclesdk.ServerApplication{
			ID:          row.ID,
			InitiatedBy: row.InitiatedBy,
			Username:    row.Username,
			Name:        row.Name,
			TenantID:    row.TenantID,
			CanReview:   true,
			CreatedAt:   row.CreatedAt.Time,
			UpdatedAt:   row.UpdatedAt.Time,
		})
	}
	httpapi.Write(ctx, w, http.StatusOK, out)
}

// CreateRequest creates or upserts a pending modification request.
func (s *Service) CreateRequest(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	actor, ok := authz.ActorFromContext(ctx)
	if !ok {
		httpapi.Forbidden(w, nil)
		return
	}

	appID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "invalid application ID"})
		return
	}

	var req chroniclesdk.CreateModificationRequestPayload
	if !httpapi.Read(ctx, w, r, &req) {
		return
	}
	if !validModTypes[req.Type] {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "invalid modification type"})
		return
	}

	var parentID uuid.NullUUID
	if req.ParentID != nil {
		parentID = uuid.NullUUID{UUID: *req.ParentID, Valid: true}
	}

	_, err = s.DB.UpsertPendingModificationRequest(ctx, database.UpsertPendingModificationRequestParams{
		ID:            uuid.New(),
		ApplicationID: appID,
		Type:          req.Type,
		ParentID:      parentID,
		Payload:       req.Payload,
	})
	if err != nil {
		httpapi.InternalServerError(w, fmt.Errorf("upsert mod request: %w", err))
		return
	}

	resp, err := s.buildApplicationResponse(ctx, appID, actor)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}
	httpapi.Write(ctx, w, http.StatusOK, resp)
}

// UpdateRequest updates a pending modification request's payload.
func (s *Service) UpdateRequest(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	actor, ok := authz.ActorFromContext(ctx)
	if !ok {
		httpapi.Forbidden(w, nil)
		return
	}

	appID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "invalid application ID"})
		return
	}
	reqID, err := uuid.Parse(chi.URLParam(r, "reqID"))
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "invalid request ID"})
		return
	}

	modReq, err := s.DB.GetModificationRequestByID(ctx, reqID)
	if err != nil || modReq.ApplicationID != appID {
		httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "request not found"})
		return
	}
	if modReq.Status != "pending" {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "can only update pending requests"})
		return
	}

	var body struct {
		Payload json.RawMessage `json:"payload"`
	}
	if !httpapi.Read(ctx, w, r, &body) {
		return
	}

	err = s.DB.UpdateModificationRequestPayload(ctx, database.UpdateModificationRequestPayloadParams{
		ID:      reqID,
		Payload: body.Payload,
	})
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	resp, err := s.buildApplicationResponse(ctx, appID, actor)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}
	httpapi.Write(ctx, w, http.StatusOK, resp)
}

// DeleteRequest deletes a rejected modification request.
func (s *Service) DeleteRequest(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	actor, ok := authz.ActorFromContext(ctx)
	if !ok {
		httpapi.Forbidden(w, nil)
		return
	}

	appID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "invalid application ID"})
		return
	}
	reqID, err := uuid.Parse(chi.URLParam(r, "reqID"))
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "invalid request ID"})
		return
	}

	modReq, err := s.DB.GetModificationRequestByID(ctx, reqID)
	if err != nil || modReq.ApplicationID != appID {
		httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "request not found"})
		return
	}
	if modReq.Status != "rejected" {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "can only delete rejected requests"})
		return
	}

	err = s.DB.DeleteModificationRequest(ctx, reqID)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	resp, err := s.buildApplicationResponse(ctx, appID, actor)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}
	httpapi.Write(ctx, w, http.StatusOK, resp)
}

// ApproveRequest approves a pending modification request, applying its changes.
func (s *Service) ApproveRequest(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	claims := chronauth.MustAuthenticatedClaims(ctx)
	actor, ok := authz.ActorFromContext(ctx)
	if !ok {
		httpapi.Forbidden(w, nil)
		return
	}

	appID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "invalid application ID"})
		return
	}
	reqID, err := uuid.Parse(chi.URLParam(r, "reqID"))
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "invalid request ID"})
		return
	}

	app, err := s.DB.GetServerApplicationByID(ctx, appID)
	if err != nil {
		httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "application not found"})
		return
	}

	modReq, err := s.DB.GetModificationRequestByID(ctx, reqID)
	if err != nil || modReq.ApplicationID != appID {
		httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "request not found"})
		return
	}
	if modReq.Status != "pending" {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "can only approve pending requests"})
		return
	}

	resourceID, err := s.ApplyModification(ctx, app, modReq)
	if err != nil {
		if isUniqueViolation(err) {
			httpapi.Write(ctx, w, http.StatusConflict, chroniclesdk.Response{Message: "resource already exists with that name"})
			return
		}
		httpapi.InternalServerError(w, fmt.Errorf("apply modification: %w", err))
		return
	}

	now := time.Now()
	updateParams := database.UpdateModificationRequestStatusParams{
		ID:         reqID,
		Status:     "approved",
		ReviewedBy: uuid.NullUUID{UUID: claims.Subject, Valid: true},
		ReviewedAt: pgTimestamptz(now),
	}
	if resourceID != nil {
		updateParams.ResourceID = uuid.NullUUID{UUID: *resourceID, Valid: true}
	}
	err = s.DB.UpdateModificationRequestStatus(ctx, updateParams)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	resp, err := s.buildApplicationResponse(ctx, appID, actor)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}
	httpapi.Write(ctx, w, http.StatusOK, resp)
}

// RejectRequest rejects a pending modification request.
func (s *Service) RejectRequest(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	claims := chronauth.MustAuthenticatedClaims(ctx)
	actor, ok := authz.ActorFromContext(ctx)
	if !ok {
		httpapi.Forbidden(w, nil)
		return
	}

	appID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "invalid application ID"})
		return
	}
	reqID, err := uuid.Parse(chi.URLParam(r, "reqID"))
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "invalid request ID"})
		return
	}

	app, err := s.DB.GetServerApplicationByID(ctx, appID)
	if err != nil {
		httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "application not found"})
		return
	}

	modReq, err := s.DB.GetModificationRequestByID(ctx, reqID)
	if err != nil || modReq.ApplicationID != appID {
		httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "request not found"})
		return
	}
	if modReq.Status == "approved" {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "cannot reject an approved request"})
		return
	}

	var body chroniclesdk.ReviewModificationRequest
	// Body is optional for reject.
	_ = httpapi.Read(ctx, w, r, &body)

	if err := s.RejectModification(ctx, app, modReq); err != nil {
		httpapi.InternalServerError(w, fmt.Errorf("reject modification: %w", err))
		return
	}

	now := time.Now()
	var adminNote pgtype.Text
	if body.AdminNote != nil {
		adminNote = pgtype.Text{String: *body.AdminNote, Valid: true}
	}
	err = s.DB.UpdateModificationRequestStatus(ctx, database.UpdateModificationRequestStatusParams{
		ID:         reqID,
		Status:     "rejected",
		AdminNote:  adminNote,
		ReviewedBy: uuid.NullUUID{UUID: claims.Subject, Valid: true},
		ReviewedAt: pgTimestamptz(now),
	})
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	resp, err := s.buildApplicationResponse(ctx, appID, actor)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}
	httpapi.Write(ctx, w, http.StatusOK, resp)
}

// --- Application admins ---

func (s *Service) ListApplicationAdmins(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	appID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "invalid application ID"})
		return
	}

	if _, err := s.DB.GetServerApplicationByID(ctx, appID); err != nil {
		httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "application not found"})
		return
	}

	userIDs, err := s.Zed.TenantApplicationAdmins(ctx, appID)
	if err != nil {
		httpapi.InternalServerError(w, fmt.Errorf("list application admins: %w", err))
		return
	}

	entries := make([]chroniclesdk.ApplicationAdminEntry, 0, len(userIDs))
	for _, uid := range userIDs {
		entry := chroniclesdk.ApplicationAdminEntry{UserID: uid}
		user, err := s.DB.GetUserByID(ctx, uid)
		if err == nil {
			entry.Username = user.Username
		}
		link, err := s.DB.GetUserAuthLinkByUserID(ctx, uid)
		if err == nil && link.Provider == "discord" {
			entry.DiscordID = link.LinkedID
		}
		entries = append(entries, entry)
	}
	httpapi.Write(ctx, w, http.StatusOK, entries)
}

func (s *Service) AddApplicationAdmin(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	appID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "invalid application ID"})
		return
	}

	var req chroniclesdk.ModifyApplicationAdminRequest
	if !httpapi.Read(ctx, w, r, &req) {
		return
	}
	if _, err := s.DB.GetServerApplicationByID(ctx, appID); err != nil {
		httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "application not found"})
		return
	}
	if _, err := s.DB.GetUserByID(ctx, req.UserID); err != nil {
		httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "user not found"})
		return
	}

	if err := s.Zed.AddTenantApplicationAdmin(ctx, appID, req.UserID); err != nil {
		httpapi.InternalServerError(w, fmt.Errorf("add application admin: %w", err))
		return
	}
	httpapi.Write(ctx, w, http.StatusNoContent, nil)
}

func (s *Service) RemoveApplicationAdmin(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	appID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "invalid application ID"})
		return
	}
	userID, err := uuid.Parse(chi.URLParam(r, "userID"))
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "invalid user ID"})
		return
	}
	if _, err := s.DB.GetServerApplicationByID(ctx, appID); err != nil {
		httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "application not found"})
		return
	}
	if err := s.Zed.RemoveTenantApplicationAdmin(ctx, appID, userID); err != nil {
		httpapi.InternalServerError(w, fmt.Errorf("remove application admin: %w", err))
		return
	}
	httpapi.Write(ctx, w, http.StatusNoContent, nil)
}

// --- Response builder ---

func (s *Service) buildApplicationResponse(ctx context.Context, appID uuid.UUID, actor *policy.ObjUser) (chroniclesdk.ServerApplication, error) {
	row, err := s.DB.GetServerApplicationByID(ctx, appID)
	if err != nil {
		return chroniclesdk.ServerApplication{}, fmt.Errorf("get application: %w", err)
	}

	tenant, err := s.DB.GetTenantByID(servicetenant.AdminBypass(ctx), row.TenantID)
	if err != nil {
		return chroniclesdk.ServerApplication{}, fmt.Errorf("get tenant: %w", err)
	}

	modReqs, err := s.DB.ListModificationRequestsByApplicationID(ctx, appID)
	if err != nil {
		return chroniclesdk.ServerApplication{}, fmt.Errorf("list mod requests: %w", err)
	}

	requests := make([]chroniclesdk.ModificationRequest, 0, len(modReqs))
	for _, mr := range modReqs {
		payload := mr.Payload
		// Clean corrupted theme payloads before sending to the frontend.
		if mr.Type == "theme" {
			var tp chroniclesdk.ThemePayload
			if err := json.Unmarshal(mr.Payload, &tp); err == nil {
				tp.Theme = cleanThemeMap(tp.Theme)
				if cleaned, err := json.Marshal(tp); err == nil {
					payload = cleaned
				}
			}
		}
		req := chroniclesdk.ModificationRequest{
			ID:            mr.ID,
			ApplicationID: mr.ApplicationID,
			Type:          mr.Type,
			Payload:       payload,
			Status:        mr.Status,
			CreatedAt:     mr.CreatedAt.Time,
			UpdatedAt:     mr.UpdatedAt.Time,
		}
		if mr.ParentID.Valid {
			req.ParentID = &mr.ParentID.UUID
		}
		if mr.AdminNote.Valid {
			req.AdminNote = &mr.AdminNote.String
		}
		if mr.ReviewedBy.Valid {
			req.ReviewedBy = &mr.ReviewedBy.UUID
		}
		if mr.ReviewedAt.Valid {
			t := mr.ReviewedAt.Time
			req.ReviewedAt = &t
		}
		if mr.ResourceID.Valid {
			req.ResourceID = &mr.ResourceID.UUID
		}
		requests = append(requests, req)
	}

	canReview, _ := s.Zed.CheckOne(ctx, nil, policy.New().GlobalChronicle().CanAdmin_tenants_User(actor))

	return chroniclesdk.ServerApplication{
		ID:          row.ID,
		InitiatedBy: row.InitiatedBy,
		Username:    row.Username,
		Name:        row.Name,
		TenantID:    row.TenantID,
		Tenant:      chroniclesdk.TenantFromDB(tenant),
		Requests:    requests,
		CanReview:   canReview,
		CreatedAt:   row.CreatedAt.Time,
		UpdatedAt:   row.UpdatedAt.Time,
	}, nil
}

// pgTimestamptz converts a time.Time to pgtype.Timestamptz.
func pgTimestamptz(t time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: t, Valid: true}
}
