package serviceapplication

import (
	"context"
	"encoding/json"
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
	"github.com/jackc/pgx/v5/pgtype"
)

// Routes returns the chi router for server application endpoints.
func (s *Service) Routes(zed *authz.Authz) http.Handler {
	r := chi.NewRouter()

	// Applicant endpoints (authenticated)
	r.With(
		httpmw.Can(zed, policy.New().GlobalChronicle().CanCreate_tenant_application_User),
	).Post("/", s.Create)

	r.Get("/", s.GetMine)
	r.Get("/{id}", s.Get)
	r.Put("/{id}", s.Update)
	r.Post("/{id}/servers", s.AddServer)
	r.Put("/{id}/servers/{serverReqID}", s.UpdateServer)
	r.Post("/{id}/servers/{serverReqID}/realms", s.AddRealm)
	r.Put("/{id}/servers/{serverReqID}/realms/{realmReqID}", s.UpdateRealm)

	// Admin endpoints
	r.With(httpmw.Can(zed, policy.New().GlobalChronicle().CanAdmin_tenants_User)).Group(func(r chi.Router) {
		r.Get("/all", s.List)
		r.Put("/{id}/review", s.ReviewField)
		r.Post("/{id}/approve", s.Approve)
		r.Post("/{id}/reject", s.Reject)
		r.Post("/{id}/servers/{serverReqID}/approve", s.ApproveServer)
		r.Post("/{id}/servers/{serverReqID}/reject", s.RejectServer)
		r.Post("/{id}/servers/{serverReqID}/realms/{realmReqID}/approve", s.ApproveRealm)
		r.Post("/{id}/servers/{serverReqID}/realms/{realmReqID}/reject", s.RejectRealm)
	})

	return r
}

// Create creates a new server application, auto-provisioning a tenant.
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

	if req.Name == "" {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "name is required"})
		return
	}
	if req.DisplayName == "" {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "display_name is required"})
		return
	}
	if len(req.Servers) == 0 {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "at least one server is required"})
		return
	}
	for i, srv := range req.Servers {
		if srv.Name == "" {
			httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
				Message: fmt.Sprintf("servers[%d].name is required", i),
			})
			return
		}
		if len(srv.Realms) == 0 {
			httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
				Message: fmt.Sprintf("servers[%d] must have at least one realm", i),
			})
			return
		}
		for j, realm := range srv.Realms {
			if realm.Name == "" {
				httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
					Message: fmt.Sprintf("servers[%d].realms[%d].name is required", i, j),
				})
				return
			}
		}
	}

	// Check no existing pending application.
	existing, err := s.DB.GetServerApplicationByInitiatedBy(ctx, userID)
	if err == nil && existing.Status == "pending" {
		httpapi.Write(ctx, w, http.StatusConflict, chroniclesdk.Response{
			Message: "you already have a pending application",
		})
		return
	}

	// Auto-provision tenant (non-discoverable).
	branding := chroniclesdk.Branding{
		DisplayName: req.DisplayName,
		Tagline:     req.Tagline,
		Tags:        req.Tags,
	}
	brandingJSON, err := json.Marshal(branding)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	tenantID := uuid.New()
	// Use admin bypass context for tenant creation (tenants table isn't behind RLS,
	// but the interceptor needs it for SpiceDB writes).
	bypassCtx := servicetenant.AdminBypass(ctx)
	_, err = s.DB.InsertTenant(bypassCtx, database.InsertTenantParams{
		ID:                  tenantID,
		Name:                req.Name,
		DisableClientUpload: false,
		IncludeInAll:        false,
		Discoverable:        false,
		Branding:            brandingJSON,
	})
	if err != nil {
		httpapi.InternalServerError(w, fmt.Errorf("create tenant: %w", err))
		return
	}

	// Insert application row.
	appID := uuid.New()
	app, err := s.DB.InsertServerApplication(bypassCtx, database.InsertServerApplicationParams{
		ID:       appID,
		InitiatedBy: userID,
		Name:     req.Name,
		TenantID: tenantID,
	})
	if err != nil {
		httpapi.InternalServerError(w, fmt.Errorf("create application: %w", err))
		return
	}

	// Insert server + realm requests.
	for _, srv := range req.Servers {
		srvID := uuid.New()
		var srvURL pgtype.Text
		if srv.URL != nil {
			srvURL = pgtype.Text{String: *srv.URL, Valid: true}
		}
		_, err := s.DB.InsertServerApplicationServer(bypassCtx, database.InsertServerApplicationServerParams{
			ID:            srvID,
			ApplicationID: appID,
			Name:          srv.Name,
			Description:   srv.Description,
			Url:           srvURL,
		})
		if err != nil {
			httpapi.InternalServerError(w, fmt.Errorf("create server request: %w", err))
			return
		}

		for _, realm := range srv.Realms {
			realmID := uuid.New()
			var realmURL pgtype.Text
			if realm.URL != nil {
				realmURL = pgtype.Text{String: *realm.URL, Valid: true}
			}
			_, err := s.DB.InsertServerApplicationRealm(bypassCtx, database.InsertServerApplicationRealmParams{
				ID:          realmID,
				AppServerID: srvID,
				Name:        realm.Name,
				Description: realm.Description,
				Url:         realmURL,
			})
			if err != nil {
				httpapi.InternalServerError(w, fmt.Errorf("create realm request: %w", err))
				return
			}
		}
	}

	// Write SpiceDB relations.
	b := policy.New()
	usr := b.User(userID)
	b.Wow_tenant(tenantID).Admin(usr)
	b.Wow_tenant_application(appID).
		Wow_tenant(b.Wow_tenant(tenantID)).
		Admin(usr)
	_, err = s.Zed.Write(ctx, *b.Txn())
	if err != nil {
		httpapi.InternalServerError(w, fmt.Errorf("write authz relations: %w", err))
		return
	}

	// Enqueue Discord notification (fire-and-forget).
	if s.Queue != nil {
		// Get username for the notification.
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

	// Return the full application response.
	resp, err := s.buildApplicationResponse(ctx, app.ID, actor)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}
	httpapi.Write(ctx, w, http.StatusCreated, resp)
}

// GetMine returns the current user's most recent application.
func (s *Service) GetMine(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	claims := chronauth.MustAuthenticatedClaims(ctx)
	actor, ok := authz.ActorFromContext(ctx)
	if !ok {
		httpapi.Forbidden(w, nil)
		return
	}

	row, err := s.DB.GetServerApplicationByInitiatedBy(ctx, claims.Subject)
	if err != nil {
		httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "no application found"})
		return
	}

	resp, err := s.buildApplicationResponse(ctx, row.ID, actor)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}
	httpapi.Write(ctx, w, http.StatusOK, resp)
}

// Get returns an application by ID. Accessible by the applicant or admins.
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

	// Check access: either the applicant (owns the row) or site admin.
	claims := chronauth.MustAuthenticatedClaims(ctx)
	row, err := s.DB.GetServerApplicationByID(ctx, appID)
	if err != nil {
		httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "application not found"})
		return
	}
	isOwner := row.InitiatedBy == claims.Subject
	isAdmin, _ := s.Zed.CheckOne(ctx, nil, policy.New().GlobalChronicle().CanAdmin_tenants_User(actor))
	if !isOwner && !isAdmin {
		httpapi.Forbidden(w, nil)
		return
	}

	resp, err := s.buildApplicationResponse(ctx, appID, actor)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}
	httpapi.Write(ctx, w, http.StatusOK, resp)
}

// Update updates the tenant branding for a pending application.
func (s *Service) Update(w http.ResponseWriter, r *http.Request) {
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

	// Verify ownership.
	if !s.isApplicationOwner(ctx, appID) {
		httpapi.Forbidden(w, nil)
		return
	}

	row, err := s.DB.GetServerApplicationByID(ctx, appID)
	if err != nil {
		httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "application not found"})
		return
	}
	if row.Status != "pending" {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "can only update pending applications"})
		return
	}

	var req chroniclesdk.UpdateServerApplicationRequest
	if !httpapi.Read(ctx, w, r, &req) {
		return
	}

	// Build tenant update params — only non-nil fields.
	updateParams := database.UpdateTenantParams{
		ID: row.TenantID,
	}
	if req.Name != nil {
		updateParams.Name = pgtype.Text{String: *req.Name, Valid: true}
	}
	if req.Slug != nil {
		updateParams.Slug = pgtype.Text{String: *req.Slug, Valid: true}
	}
	if req.Branding != nil {
		brandingJSON, err := json.Marshal(req.Branding)
		if err != nil {
			httpapi.InternalServerError(w, err)
			return
		}
		updateParams.Branding = brandingJSON
	} else {
		// Build partial branding update from individual fields.
		tenant, err := s.DB.GetTenantByID(servicetenant.AdminBypass(ctx), row.TenantID)
		if err != nil {
			httpapi.InternalServerError(w, err)
			return
		}
		var existingBranding chroniclesdk.Branding
		if len(tenant.Branding) > 0 {
			_ = json.Unmarshal(tenant.Branding, &existingBranding)
		}
		changed := false
		if req.DisplayName != nil {
			existingBranding.DisplayName = *req.DisplayName
			changed = true
		}
		if req.Tagline != nil {
			existingBranding.Tagline = *req.Tagline
			changed = true
		}
		if req.Description != nil {
			existingBranding.Description = *req.Description
			changed = true
		}
		if req.Tags != nil {
			existingBranding.Tags = req.Tags
			changed = true
		}
		if changed {
			brandingJSON, err := json.Marshal(existingBranding)
			if err != nil {
				httpapi.InternalServerError(w, err)
				return
			}
			updateParams.Branding = brandingJSON
		}
	}

	bypassCtx := servicetenant.AdminBypass(ctx)
	_, err = s.DB.UpdateTenant(bypassCtx, updateParams)
	if err != nil {
		httpapi.InternalServerError(w, fmt.Errorf("update tenant: %w", err))
		return
	}

	// Reset review status for affected sections.
	s.resetAffectedReviews(ctx, row, req)

	resp, err := s.buildApplicationResponse(ctx, appID, actor)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}
	httpapi.Write(ctx, w, http.StatusOK, resp)
}

// AddServer adds a new server request to a pending application.
func (s *Service) AddServer(w http.ResponseWriter, r *http.Request) {
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

	if !s.isApplicationOwner(ctx, appID) {
		httpapi.Forbidden(w, nil)
		return
	}

	row, err := s.DB.GetServerApplicationByID(ctx, appID)
	if err != nil {
		httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "application not found"})
		return
	}
	if row.Status != "pending" {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "can only modify pending applications"})
		return
	}

	var req chroniclesdk.AddServerRequest
	if !httpapi.Read(ctx, w, r, &req) {
		return
	}
	if req.Name == "" {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "name is required"})
		return
	}

	srvID := uuid.New()
	var srvURL pgtype.Text
	if req.URL != nil {
		srvURL = pgtype.Text{String: *req.URL, Valid: true}
	}
	_, err = s.DB.InsertServerApplicationServer(ctx, database.InsertServerApplicationServerParams{
		ID:            srvID,
		ApplicationID: appID,
		Name:          req.Name,
		Description:   req.Description,
		Url:           srvURL,
	})
	if err != nil {
		httpapi.InternalServerError(w, fmt.Errorf("create server request: %w", err))
		return
	}

	// Insert realms for this server.
	for _, realm := range req.Realms {
		realmID := uuid.New()
		var realmURL pgtype.Text
		if realm.URL != nil {
			realmURL = pgtype.Text{String: *realm.URL, Valid: true}
		}
		_, err := s.DB.InsertServerApplicationRealm(ctx, database.InsertServerApplicationRealmParams{
			ID:          realmID,
			AppServerID: srvID,
			Name:        realm.Name,
			Description: realm.Description,
			Url:         realmURL,
		})
		if err != nil {
			httpapi.InternalServerError(w, fmt.Errorf("create realm request: %w", err))
			return
		}
	}

	resp, err := s.buildApplicationResponse(ctx, appID, actor)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}
	httpapi.Write(ctx, w, http.StatusCreated, resp)
}

// UpdateServer updates a server request within an application.
func (s *Service) UpdateServer(w http.ResponseWriter, r *http.Request) {
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
	serverReqID, err := uuid.Parse(chi.URLParam(r, "serverReqID"))
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "invalid server request ID"})
		return
	}

	if !s.isApplicationOwner(ctx, appID) {
		httpapi.Forbidden(w, nil)
		return
	}

	srvReq, err := s.DB.GetServerApplicationServer(ctx, serverReqID)
	if err != nil || srvReq.ApplicationID != appID {
		httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "server request not found"})
		return
	}
	if srvReq.Status != "pending" && srvReq.Status != "rejected" {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "can only update pending or rejected server requests"})
		return
	}

	var req chroniclesdk.AddServerRequest
	if !httpapi.Read(ctx, w, r, &req) {
		return
	}

	var srvURL pgtype.Text
	if req.URL != nil {
		srvURL = pgtype.Text{String: *req.URL, Valid: true}
	}
	err = s.DB.UpdateServerApplicationServer(ctx, database.UpdateServerApplicationServerParams{
		ID:          serverReqID,
		Name:        req.Name,
		Description: req.Description,
		Url:         srvURL,
	})
	if err != nil {
		httpapi.InternalServerError(w, fmt.Errorf("update server request: %w", err))
		return
	}

	resp, err := s.buildApplicationResponse(ctx, appID, actor)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}
	httpapi.Write(ctx, w, http.StatusOK, resp)
}

// AddRealm adds a realm request to a server request.
func (s *Service) AddRealm(w http.ResponseWriter, r *http.Request) {
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
	serverReqID, err := uuid.Parse(chi.URLParam(r, "serverReqID"))
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "invalid server request ID"})
		return
	}

	if !s.isApplicationOwner(ctx, appID) {
		httpapi.Forbidden(w, nil)
		return
	}

	srvReq, err := s.DB.GetServerApplicationServer(ctx, serverReqID)
	if err != nil || srvReq.ApplicationID != appID {
		httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "server request not found"})
		return
	}

	var req chroniclesdk.AddRealmRequest
	if !httpapi.Read(ctx, w, r, &req) {
		return
	}
	if req.Name == "" {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "name is required"})
		return
	}

	realmID := uuid.New()
	var realmURL pgtype.Text
	if req.URL != nil {
		realmURL = pgtype.Text{String: *req.URL, Valid: true}
	}
	_, err = s.DB.InsertServerApplicationRealm(ctx, database.InsertServerApplicationRealmParams{
		ID:          realmID,
		AppServerID: serverReqID,
		Name:        req.Name,
		Description: req.Description,
		Url:         realmURL,
	})
	if err != nil {
		httpapi.InternalServerError(w, fmt.Errorf("create realm request: %w", err))
		return
	}

	resp, err := s.buildApplicationResponse(ctx, appID, actor)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}
	httpapi.Write(ctx, w, http.StatusCreated, resp)
}

// UpdateRealm updates a realm request.
func (s *Service) UpdateRealm(w http.ResponseWriter, r *http.Request) {
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
	realmReqID, err := uuid.Parse(chi.URLParam(r, "realmReqID"))
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "invalid realm request ID"})
		return
	}

	if !s.isApplicationOwner(ctx, appID) {
		httpapi.Forbidden(w, nil)
		return
	}

	realmReq, err := s.DB.GetServerApplicationRealm(ctx, realmReqID)
	if err != nil {
		httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "realm request not found"})
		return
	}
	// Verify the realm belongs to this application via its server.
	srvReq, err := s.DB.GetServerApplicationServer(ctx, realmReq.AppServerID)
	if err != nil || srvReq.ApplicationID != appID {
		httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "realm request not found"})
		return
	}

	var req chroniclesdk.AddRealmRequest
	if !httpapi.Read(ctx, w, r, &req) {
		return
	}

	var realmURL pgtype.Text
	if req.URL != nil {
		realmURL = pgtype.Text{String: *req.URL, Valid: true}
	}
	err = s.DB.UpdateServerApplicationRealm(ctx, database.UpdateServerApplicationRealmParams{
		ID:          realmReqID,
		Name:        req.Name,
		Description: req.Description,
		Url:         realmURL,
	})
	if err != nil {
		httpapi.InternalServerError(w, fmt.Errorf("update realm request: %w", err))
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
	statusFilter := r.URL.Query().Get("status")

	var status pgtype.Text
	if statusFilter != "" {
		status = pgtype.Text{String: statusFilter, Valid: true}
	}

	rows, err := s.DB.ListServerApplications(ctx, status)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	out := make([]chroniclesdk.ServerApplication, 0, len(rows))
	for _, row := range rows {
		app := chroniclesdk.ServerApplication{
			ID:        row.ID,
			InitiatedBy: row.InitiatedBy,
			Username:    row.Username,
			Status:      row.Status,
			Name:        row.Name,
			TenantID:    row.TenantID,
			CanReview: true,
			CreatedAt: row.CreatedAt.Time,
			UpdatedAt: row.UpdatedAt.Time,
		}
		if row.AdminNote.Valid {
			app.AdminNote = &row.AdminNote.String
		}
		app.FieldReviews = parseFieldReviews(row.FieldReviews)
		out = append(out, app)
	}

	httpapi.Write(ctx, w, http.StatusOK, out)
}

// ReviewField sets the review status for a tenant branding section.
func (s *Service) ReviewField(w http.ResponseWriter, r *http.Request) {
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

	var req chroniclesdk.ReviewFieldRequest
	if !httpapi.Read(ctx, w, r, &req) {
		return
	}

	validSections := map[string]bool{"core": true, "slug": true, "description": true, "logos": true, "theme": true}
	if !validSections[req.Section] {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "invalid section"})
		return
	}
	if req.Status != "approved" && req.Status != "rejected" {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "status must be 'approved' or 'rejected'"})
		return
	}

	row, err := s.DB.GetServerApplicationByID(ctx, appID)
	if err != nil {
		httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "application not found"})
		return
	}
	if row.Status != "pending" {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "can only review pending applications"})
		return
	}

	reviews := parseFieldReviews(row.FieldReviews)
	now := time.Now()
	reviews[req.Section] = chroniclesdk.FieldReview{
		Status:     req.Status,
		Note:       req.Note,
		ReviewedAt: &now,
	}

	reviewsJSON, err := json.Marshal(reviews)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}
	err = s.DB.UpdateServerApplicationFieldReviews(ctx, database.UpdateServerApplicationFieldReviewsParams{
		ID:           appID,
		FieldReviews: reviewsJSON,
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

// Approve finalizes the application approval.
func (s *Service) Approve(w http.ResponseWriter, r *http.Request) {
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

	row, err := s.DB.GetServerApplicationByID(ctx, appID)
	if err != nil {
		httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "application not found"})
		return
	}
	if row.Status != "pending" {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "can only approve pending applications"})
		return
	}

	reviews := parseFieldReviews(row.FieldReviews)
	for _, section := range []string{"core", "slug"} {
		review, exists := reviews[section]
		if !exists || review.Status != "approved" {
			httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
				Message: fmt.Sprintf("required section '%s' must be approved first", section),
			})
			return
		}
	}

	// Verify at least one server+realm is approved.
	servers, err := s.DB.ListServerApplicationServers(ctx, appID)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}
	hasApprovedServerWithRealm := false
	for _, srv := range servers {
		if srv.Status == "approved" && srv.ServerID.Valid {
			realms, err := s.DB.ListServerApplicationRealms(ctx, srv.ID)
			if err != nil {
				httpapi.InternalServerError(w, err)
				return
			}
			for _, realm := range realms {
				if realm.Status == "approved" && realm.RealmID.Valid {
					hasApprovedServerWithRealm = true
					break
				}
			}
		}
		if hasApprovedServerWithRealm {
			break
		}
	}
	if !hasApprovedServerWithRealm {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
			Message: "at least one server with an approved realm is required",
		})
		return
	}

	reviewedBy := uuid.NullUUID{UUID: claims.Subject, Valid: true}
	err = s.DB.UpdateServerApplicationStatus(ctx, database.UpdateServerApplicationStatusParams{
		ID:         appID,
		Status:     "approved",
		ReviewedBy: reviewedBy,
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

// Reject rejects an application.
func (s *Service) Reject(w http.ResponseWriter, r *http.Request) {
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

	var req chroniclesdk.RejectApplicationRequest
	if !httpapi.Read(ctx, w, r, &req) {
		return
	}

	row, err := s.DB.GetServerApplicationByID(ctx, appID)
	if err != nil {
		httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "application not found"})
		return
	}
	if row.Status != "pending" {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "can only reject pending applications"})
		return
	}

	var adminNote pgtype.Text
	if req.AdminNote != nil {
		adminNote = pgtype.Text{String: *req.AdminNote, Valid: true}
	}
	reviewedBy := uuid.NullUUID{UUID: claims.Subject, Valid: true}
	err = s.DB.UpdateServerApplicationStatus(ctx, database.UpdateServerApplicationStatusParams{
		ID:         appID,
		Status:     "rejected",
		AdminNote:  adminNote,
		ReviewedBy: reviewedBy,
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

// ApproveServer approves a server request, creating the actual wow_server.
func (s *Service) ApproveServer(w http.ResponseWriter, r *http.Request) {
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
	serverReqID, err := uuid.Parse(chi.URLParam(r, "serverReqID"))
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "invalid server request ID"})
		return
	}

	app, err := s.DB.GetServerApplicationByID(ctx, appID)
	if err != nil {
		httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "application not found"})
		return
	}

	srvReq, err := s.DB.GetServerApplicationServer(ctx, serverReqID)
	if err != nil || srvReq.ApplicationID != appID {
		httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "server request not found"})
		return
	}
	if srvReq.Status != "pending" {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "server request is not pending"})
		return
	}

	// Create actual wow_server (interceptor writes wow_server#chronicle).
	bypassCtx := servicetenant.AdminBypass(ctx)
	serverID := uuid.New()
	var srvURL pgtype.Text
	if srvReq.Url.Valid {
		srvURL = srvReq.Url
	}
	_, err = s.DB.InsertWoWServer(bypassCtx, database.InsertWoWServerParams{
		ID:          serverID,
		Name:        srvReq.Name,
		Description: srvReq.Description,
		Url:         srvURL,
		CreatedBy:   uuid.NullUUID{UUID: app.InitiatedBy, Valid: true},
	})
	if err != nil {
		httpapi.InternalServerError(w, fmt.Errorf("create wow server: %w", err))
		return
	}

	// Assign server to tenant (interceptor writes wow_server#tenant).
	err = s.DB.SetServerTenant(bypassCtx, database.SetServerTenantParams{
		ID:       serverID,
		TenantID: uuid.NullUUID{UUID: app.TenantID, Valid: true},
	})
	if err != nil {
		httpapi.InternalServerError(w, fmt.Errorf("set server tenant: %w", err))
		return
	}

	// Update the server request status.
	err = s.DB.UpdateServerApplicationServerStatus(ctx, database.UpdateServerApplicationServerStatusParams{
		ID:       serverReqID,
		Status:   "approved",
		ServerID: uuid.NullUUID{UUID: serverID, Valid: true},
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

// RejectServer rejects a server request.
func (s *Service) RejectServer(w http.ResponseWriter, r *http.Request) {
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
	serverReqID, err := uuid.Parse(chi.URLParam(r, "serverReqID"))
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "invalid server request ID"})
		return
	}

	var req chroniclesdk.ReviewServerRequest
	if !httpapi.Read(ctx, w, r, &req) {
		return
	}

	srvReq, err := s.DB.GetServerApplicationServer(ctx, serverReqID)
	if err != nil || srvReq.ApplicationID != appID {
		httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "server request not found"})
		return
	}

	var adminNote pgtype.Text
	if req.AdminNote != nil {
		adminNote = pgtype.Text{String: *req.AdminNote, Valid: true}
	}
	err = s.DB.UpdateServerApplicationServerStatus(ctx, database.UpdateServerApplicationServerStatusParams{
		ID:        serverReqID,
		Status:    "rejected",
		AdminNote: adminNote,
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

// ApproveRealm approves a realm request, creating the actual wow_server_realm.
func (s *Service) ApproveRealm(w http.ResponseWriter, r *http.Request) {
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
	realmReqID, err := uuid.Parse(chi.URLParam(r, "realmReqID"))
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "invalid realm request ID"})
		return
	}

	app, err := s.DB.GetServerApplicationByID(ctx, appID)
	if err != nil {
		httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "application not found"})
		return
	}

	realmReq, err := s.DB.GetServerApplicationRealm(ctx, realmReqID)
	if err != nil {
		httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "realm request not found"})
		return
	}

	// Verify the parent server is approved.
	srvReq, err := s.DB.GetServerApplicationServer(ctx, realmReq.AppServerID)
	if err != nil || srvReq.ApplicationID != appID {
		httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "realm request not found"})
		return
	}
	if !srvReq.ServerID.Valid {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
			Message: "parent server must be approved before approving realms",
		})
		return
	}
	if realmReq.Status != "pending" {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "realm request is not pending"})
		return
	}

	// Create actual realm (interceptor writes wow_server_realm#wow_server).
	bypassCtx := servicetenant.AdminBypass(ctx)
	realmID := uuid.New()
	var realmURL pgtype.Text
	if realmReq.Url.Valid {
		realmURL = realmReq.Url
	}
	_, err = s.DB.InsertWoWServerRealm(bypassCtx, database.InsertWoWServerRealmParams{
		ID:        realmID,
		ServerID:  srvReq.ServerID.UUID,
		Name:      realmReq.Name,
		Url:       realmURL,
		CreatedBy: uuid.NullUUID{UUID: app.InitiatedBy, Valid: true},
	})
	if err != nil {
		httpapi.InternalServerError(w, fmt.Errorf("create realm: %w", err))
		return
	}

	err = s.DB.UpdateServerApplicationRealmStatus(ctx, database.UpdateServerApplicationRealmStatusParams{
		ID:      realmReqID,
		Status:  "approved",
		RealmID: uuid.NullUUID{UUID: realmID, Valid: true},
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

// RejectRealm rejects a realm request.
func (s *Service) RejectRealm(w http.ResponseWriter, r *http.Request) {
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
	realmReqID, err := uuid.Parse(chi.URLParam(r, "realmReqID"))
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{Message: "invalid realm request ID"})
		return
	}

	var req chroniclesdk.ReviewRealmRequest
	if !httpapi.Read(ctx, w, r, &req) {
		return
	}

	realmReq, err := s.DB.GetServerApplicationRealm(ctx, realmReqID)
	if err != nil {
		httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "realm request not found"})
		return
	}
	srvReq, err := s.DB.GetServerApplicationServer(ctx, realmReq.AppServerID)
	if err != nil || srvReq.ApplicationID != appID {
		httpapi.Write(ctx, w, http.StatusNotFound, chroniclesdk.Response{Message: "realm request not found"})
		return
	}

	var adminNote pgtype.Text
	if req.AdminNote != nil {
		adminNote = pgtype.Text{String: *req.AdminNote, Valid: true}
	}
	err = s.DB.UpdateServerApplicationRealmStatus(ctx, database.UpdateServerApplicationRealmStatusParams{
		ID:        realmReqID,
		Status:    "rejected",
		AdminNote: adminNote,
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

// buildApplicationResponse assembles the full application response from DB rows.
func (s *Service) buildApplicationResponse(ctx context.Context, appID uuid.UUID, actor *policy.ObjUser) (chroniclesdk.ServerApplication, error) {
	row, err := s.DB.GetServerApplicationByID(ctx, appID)
	if err != nil {
		return chroniclesdk.ServerApplication{}, fmt.Errorf("get application: %w", err)
	}

	// Load tenant.
	tenant, err := s.DB.GetTenantByID(servicetenant.AdminBypass(ctx), row.TenantID)
	if err != nil {
		return chroniclesdk.ServerApplication{}, fmt.Errorf("get tenant: %w", err)
	}

	// Load servers and realms.
	srvRows, err := s.DB.ListServerApplicationServers(ctx, appID)
	if err != nil {
		return chroniclesdk.ServerApplication{}, fmt.Errorf("list servers: %w", err)
	}
	realmRows, err := s.DB.ListServerApplicationRealmsByApplicationID(ctx, appID)
	if err != nil {
		return chroniclesdk.ServerApplication{}, fmt.Errorf("list realms: %w", err)
	}

	// Group realms by server.
	realmsByServer := make(map[uuid.UUID][]chroniclesdk.ServerApplicationRealm)
	for _, realm := range realmRows {
		r := chroniclesdk.ServerApplicationRealm{
			ID:          realm.ID,
			Name:        realm.Name,
			Description: realm.Description,
			Status:      realm.Status,
			CreatedAt:   realm.CreatedAt.Time,
		}
		if realm.Url.Valid {
			r.URL = &realm.Url.String
		}
		if realm.AdminNote.Valid {
			r.AdminNote = &realm.AdminNote.String
		}
		if realm.RealmID.Valid {
			r.RealmID = &realm.RealmID.UUID
		}
		realmsByServer[realm.AppServerID] = append(realmsByServer[realm.AppServerID], r)
	}

	servers := make([]chroniclesdk.ServerApplicationServer, 0, len(srvRows))
	for _, srv := range srvRows {
		s := chroniclesdk.ServerApplicationServer{
			ID:          srv.ID,
			Name:        srv.Name,
			Description: srv.Description,
			Status:      srv.Status,
			Realms:      realmsByServer[srv.ID],
			CreatedAt:   srv.CreatedAt.Time,
		}
		if s.Realms == nil {
			s.Realms = []chroniclesdk.ServerApplicationRealm{}
		}
		if srv.Url.Valid {
			s.URL = &srv.Url.String
		}
		if srv.AdminNote.Valid {
			s.AdminNote = &srv.AdminNote.String
		}
		if srv.ServerID.Valid {
			s.ServerID = &srv.ServerID.UUID
		}
		servers = append(servers, s)
	}

	// Check if the caller can review.
	canReview, _ := s.Zed.CheckOne(ctx, nil, policy.New().GlobalChronicle().CanAdmin_tenants_User(actor))

	app := chroniclesdk.ServerApplication{
		ID:           row.ID,
		InitiatedBy:  row.InitiatedBy,
		Username:     row.Username,
		Status:       row.Status,
		Name:         row.Name,
		TenantID:     row.TenantID,
		Tenant:       chroniclesdk.TenantFromDB(tenant),
		FieldReviews: parseFieldReviews(row.FieldReviews),
		Servers:      servers,
		CanReview:    canReview,
		CreatedAt:    row.CreatedAt.Time,
		UpdatedAt:    row.UpdatedAt.Time,
	}
	if row.AdminNote.Valid {
		app.AdminNote = &row.AdminNote.String
	}

	return app, nil
}

// isApplicationOwner checks if the given user owns the application.
func (s *Service) isApplicationOwner(ctx context.Context, appID uuid.UUID) bool {
	claims := chronauth.MustAuthenticatedClaims(ctx)
	row, err := s.DB.GetServerApplicationByID(ctx, appID)
	if err != nil {
		return false
	}
	return row.InitiatedBy == claims.Subject
}

// parseFieldReviews deserializes the JSONB field_reviews column.
func parseFieldReviews(data []byte) map[string]chroniclesdk.FieldReview {
	reviews := make(map[string]chroniclesdk.FieldReview)
	if len(data) > 0 {
		_ = json.Unmarshal(data, &reviews)
	}
	return reviews
}

// resetAffectedReviews resets review status to "pending" for sections whose fields changed.
func (s *Service) resetAffectedReviews(ctx context.Context, row database.GetServerApplicationByIDRow, req chroniclesdk.UpdateServerApplicationRequest) {
	reviews := parseFieldReviews(row.FieldReviews)
	changed := false

	if req.Name != nil || req.DisplayName != nil || req.Tagline != nil || req.Tags != nil {
		if review, ok := reviews["core"]; ok && review.Status == "rejected" {
			reviews["core"] = chroniclesdk.FieldReview{Status: "pending"}
			changed = true
		}
	}
	if req.Slug != nil {
		if review, ok := reviews["slug"]; ok && review.Status == "rejected" {
			reviews["slug"] = chroniclesdk.FieldReview{Status: "pending"}
			changed = true
		}
	}
	if req.Description != nil {
		if review, ok := reviews["description"]; ok && review.Status == "rejected" {
			reviews["description"] = chroniclesdk.FieldReview{Status: "pending"}
			changed = true
		}
	}
	if req.Branding != nil {
		if req.Branding.SquareLogo != "" || req.Branding.LogoWide != "" || req.Branding.Favicon != "" || req.Branding.BackgroundBanner != "" {
			if review, ok := reviews["logos"]; ok && review.Status == "rejected" {
				reviews["logos"] = chroniclesdk.FieldReview{Status: "pending"}
				changed = true
			}
		}
		if len(req.Branding.Theme) > 0 {
			if review, ok := reviews["theme"]; ok && review.Status == "rejected" {
				reviews["theme"] = chroniclesdk.FieldReview{Status: "pending"}
				changed = true
			}
		}
	}

	if changed {
		reviewsJSON, err := json.Marshal(reviews)
		if err != nil {
			return
		}
		_ = s.DB.UpdateServerApplicationFieldReviews(ctx, database.UpdateServerApplicationFieldReviewsParams{
			ID:           row.ID,
			FieldReviews: reviewsJSON,
		})
	}
}
