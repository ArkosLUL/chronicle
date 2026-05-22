package serviceapplication

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/Emyrk/chronicle/api/chroniclesdk"
	"github.com/Emyrk/chronicle/database"
	"github.com/Emyrk/chronicle/internal/services/servicetenant"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

// cleanThemeMap removes junk numeric-indexed entries that result from
// a JSON string being unmarshalled into map[string]string (e.g. "0":"{", "10":"\"").
// Only keeps entries whose keys are NOT purely numeric.
func cleanThemeMap(m map[string]string) map[string]string {
	clean := make(map[string]string, len(m))
	for k, v := range m {
		if !isNumeric(k) {
			clean[k] = v
		}
	}
	return clean
}

func isNumeric(s string) bool {
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	return len(s) > 0
}

// ApplyModification dispatches to the per-type apply method.
// Called when an admin approves a modification request.
func (s *Service) ApplyModification(ctx context.Context, app database.GetServerApplicationByIDRow, req database.ApplicationModificationRequest) (*uuid.UUID, error) {
	switch req.Type {
	case "core":
		return nil, s.applyCore(ctx, app, req.Payload)
	case "slug":
		return nil, s.applySlug(ctx, app, req.Payload)
	case "description":
		return nil, s.applyDescription(ctx, app, req.Payload)
	case "logos":
		return nil, s.applyLogos(ctx, app, req.Payload)
	case "theme":
		return nil, s.applyTheme(ctx, app, req.Payload)
	case "server":
		return s.applyServer(ctx, app, req.Payload)
	case "realm":
		return s.applyRealm(ctx, app, req)
	default:
		return nil, fmt.Errorf("unknown modification type: %s", req.Type)
	}
}

// RejectModification is called when an admin rejects a request.
// Currently no type-specific logic, but the dispatch exists for future use.
func (s *Service) RejectModification(ctx context.Context, app database.GetServerApplicationByIDRow, req database.ApplicationModificationRequest) error {
	// No type-specific rejection logic needed yet.
	// The status update is handled by the caller.
	return nil
}

func (s *Service) applyCore(ctx context.Context, app database.GetServerApplicationByIDRow, payload []byte) error {
	var p chroniclesdk.CorePayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("unmarshal core payload: %w", err)
	}

	bypassCtx := servicetenant.AdminBypass(ctx)
	tenant, err := s.DB.GetTenantByID(bypassCtx, app.TenantID)
	if err != nil {
		return fmt.Errorf("get tenant: %w", err)
	}

	var branding chroniclesdk.Branding
	if len(tenant.Branding) > 0 {
		_ = json.Unmarshal(tenant.Branding, &branding)
	}
	branding.DisplayName = p.DisplayName
	branding.Tagline = p.Tagline
	branding.Tags = p.Tags

	brandingJSON, err := json.Marshal(branding)
	if err != nil {
		return err
	}

	_, err = s.DB.UpdateTenant(bypassCtx, database.UpdateTenantParams{
		ID:       app.TenantID,
		Name:     pgtype.Text{String: p.Name, Valid: true},
		Branding: brandingJSON,
	})
	if err != nil {
		return fmt.Errorf("update tenant: %w", err)
	}
	s.Tenant.InvalidateCache()
	return nil
}

func (s *Service) applySlug(ctx context.Context, app database.GetServerApplicationByIDRow, payload []byte) error {
	var p chroniclesdk.SlugPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("unmarshal slug payload: %w", err)
	}

	bypassCtx := servicetenant.AdminBypass(ctx)
	_, err := s.DB.UpdateTenant(bypassCtx, database.UpdateTenantParams{
		ID:   app.TenantID,
		Slug: pgtype.Text{String: p.Slug, Valid: true},
	})
	if err != nil {
		return fmt.Errorf("update tenant slug: %w", err)
	}
	s.Tenant.InvalidateCache()
	return nil
}

func (s *Service) applyDescription(ctx context.Context, app database.GetServerApplicationByIDRow, payload []byte) error {
	var p chroniclesdk.DescriptionPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("unmarshal description payload: %w", err)
	}

	bypassCtx := servicetenant.AdminBypass(ctx)
	tenant, err := s.DB.GetTenantByID(bypassCtx, app.TenantID)
	if err != nil {
		return fmt.Errorf("get tenant: %w", err)
	}

	var branding chroniclesdk.Branding
	if len(tenant.Branding) > 0 {
		_ = json.Unmarshal(tenant.Branding, &branding)
	}
	branding.Description = p.Description

	brandingJSON, err := json.Marshal(branding)
	if err != nil {
		return err
	}

	_, err = s.DB.UpdateTenant(bypassCtx, database.UpdateTenantParams{
		ID:       app.TenantID,
		Branding: brandingJSON,
	})
	if err != nil {
		return fmt.Errorf("update tenant: %w", err)
	}
	s.Tenant.InvalidateCache()
	return nil
}

func (s *Service) applyLogos(ctx context.Context, app database.GetServerApplicationByIDRow, payload []byte) error {
	var p chroniclesdk.LogosPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("unmarshal logos payload: %w", err)
	}

	bypassCtx := servicetenant.AdminBypass(ctx)
	tenant, err := s.DB.GetTenantByID(bypassCtx, app.TenantID)
	if err != nil {
		return fmt.Errorf("get tenant: %w", err)
	}

	var branding chroniclesdk.Branding
	if len(tenant.Branding) > 0 {
		_ = json.Unmarshal(tenant.Branding, &branding)
	}
	branding.SquareLogo = p.SquareLogo
	branding.LogoWide = p.LogoWide
	branding.Favicon = p.Favicon
	branding.BackgroundBanner = p.BackgroundBanner

	brandingJSON, err := json.Marshal(branding)
	if err != nil {
		return err
	}

	_, err = s.DB.UpdateTenant(bypassCtx, database.UpdateTenantParams{
		ID:       app.TenantID,
		Branding: brandingJSON,
	})
	if err != nil {
		return fmt.Errorf("update tenant: %w", err)
	}
	s.Tenant.InvalidateCache()
	return nil
}

func (s *Service) applyTheme(ctx context.Context, app database.GetServerApplicationByIDRow, payload []byte) error {
	var p chroniclesdk.ThemePayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("unmarshal theme payload: %w", err)
	}

	bypassCtx := servicetenant.AdminBypass(ctx)
	tenant, err := s.DB.GetTenantByID(bypassCtx, app.TenantID)
	if err != nil {
		return fmt.Errorf("get tenant: %w", err)
	}

	var branding chroniclesdk.Branding
	if len(tenant.Branding) > 0 {
		_ = json.Unmarshal(tenant.Branding, &branding)
	}
	branding.Theme = cleanThemeMap(p.Theme)

	brandingJSON, err := json.Marshal(branding)
	if err != nil {
		return err
	}

	_, err = s.DB.UpdateTenant(bypassCtx, database.UpdateTenantParams{
		ID:       app.TenantID,
		Branding: brandingJSON,
	})
	if err != nil {
		return fmt.Errorf("update tenant: %w", err)
	}
	s.Tenant.InvalidateCache()
	return nil
}

func (s *Service) applyServer(ctx context.Context, app database.GetServerApplicationByIDRow, payload []byte) (*uuid.UUID, error) {
	var p chroniclesdk.ServerPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return nil, fmt.Errorf("unmarshal server payload: %w", err)
	}

	bypassCtx := servicetenant.AdminBypass(ctx)
	serverID := uuid.New()
	var srvURL pgtype.Text
	if p.URL != nil {
		srvURL = pgtype.Text{String: *p.URL, Valid: true}
	}

	_, err := s.Zed.InsertWoWServer(bypassCtx, database.InsertWoWServerParams{
		ID:          serverID,
		Name:        p.Name,
		Description: p.Description,
		Url:         srvURL,
		CreatedBy:   uuid.NullUUID{UUID: app.InitiatedBy, Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("create wow server: %w", err)
	}

	err = s.Zed.SetServerTenant(bypassCtx, database.SetServerTenantParams{
		ID:       serverID,
		TenantID: uuid.NullUUID{UUID: app.TenantID, Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("set server tenant: %w", err)
	}

	return &serverID, nil
}

func (s *Service) applyRealm(ctx context.Context, app database.GetServerApplicationByIDRow, req database.ApplicationModificationRequest) (*uuid.UUID, error) {
	var p chroniclesdk.RealmPayload
	if err := json.Unmarshal(req.Payload, &p); err != nil {
		return nil, fmt.Errorf("unmarshal realm payload: %w", err)
	}

	if !req.ParentID.Valid {
		return nil, fmt.Errorf("realm request must have a parent server request")
	}

	// Look up the parent server's resource_id.
	parentReq, err := s.DB.GetModificationRequestByID(ctx, req.ParentID.UUID)
	if err != nil {
		return nil, fmt.Errorf("get parent server request: %w", err)
	}
	if parentReq.Status != "approved" || !parentReq.ResourceID.Valid {
		return nil, fmt.Errorf("parent server must be approved before realms")
	}

	bypassCtx := servicetenant.AdminBypass(ctx)
	realmID := uuid.New()
	var realmURL pgtype.Text
	if p.URL != nil {
		realmURL = pgtype.Text{String: *p.URL, Valid: true}
	}

	_, err = s.Zed.InsertWoWServerRealm(bypassCtx, database.InsertWoWServerRealmParams{
		ID:        realmID,
		ServerID:  parentReq.ResourceID.UUID,
		Name:      p.Name,
		Url:       realmURL,
		CreatedBy: uuid.NullUUID{UUID: app.InitiatedBy, Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("create realm: %w", err)
	}

	return &realmID, nil
}
