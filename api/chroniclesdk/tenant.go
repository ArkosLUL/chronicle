package chroniclesdk

import (
	"encoding/json"
	"time"

	"github.com/Emyrk/chronicle/database"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

// Tenant is the SDK type exposed to the frontend.
type Tenant struct {
	ID                  uuid.UUID       `json:"id"`
	Slug                *string         `json:"slug"`
	Name                string          `json:"name"`
	DisableClientUpload bool            `json:"disable_client_upload"`
	IncludeInAll        bool            `json:"include_in_all"`
	Branding            *Branding `json:"branding"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time       `json:"updated_at"`
}

// Branding holds the visual identity for a tenant subdomain or the primary domain.
type Branding struct {
	SquareLogo       string `json:"square_logo,omitempty"`
	DisplayName      string `json:"display_name,omitempty"`
	Tagline          string `json:"tagline,omitempty"`
	Description      string `json:"description,omitempty"`
	BackgroundBanner string `json:"background_banner,omitempty"`
}

// TenantFromDB converts a database.Tenant to the SDK type.
func TenantFromDB(t database.Tenant) Tenant {
	out := Tenant{
		ID:                  t.ID,
		Name:                t.Name,
		DisableClientUpload: t.DisableClientUpload,
		IncludeInAll:        t.IncludeInAll,
		CreatedAt:           t.CreatedAt.Time,
		UpdatedAt:           t.UpdatedAt.Time,
	}
	if t.Slug.Valid {
		out.Slug = &t.Slug.String
	}
	if len(t.Branding) > 0 {
		var b Branding
		if err := json.Unmarshal(t.Branding, &b); err == nil {
			out.Branding = &b
		}
	}
	return out
}

// SetServerTenantRequest assigns or removes a tenant from a server.
// Pass null tenant_id to remove the assignment.
type SetServerTenantRequest struct {
	TenantID *uuid.UUID `json:"tenant_id"`
}

// UpsertTenantRequest is the request body for creating or updating a tenant.
// UpsertTenantRequest is the request body for creating or updating a tenant.
// Pointer fields are optional — if nil on update, no change occurs (COALESCE
// preserves the existing value).
type UpsertTenantRequest struct {
	ID                  uuid.NullUUID   `json:"id"`
	Slug                *string         `json:"slug"`
	Name                string          `json:"name"`
	DisableClientUpload *bool           `json:"disable_client_upload"`
	IncludeInAll        *bool           `json:"include_in_all"`
	Branding            *Branding `json:"branding"`
}

// IsCreate returns true when the request should insert a new tenant.
func (r UpsertTenantRequest) IsCreate() bool {
	return !r.ID.Valid || r.ID.UUID == uuid.Nil
}

func (r UpsertTenantRequest) marshalBranding() []byte {
	if r.Branding == nil {
		return nil
	}
	b, _ := json.Marshal(r.Branding)
	return b
}

// ToInsertParams converts the request for a new tenant.
func (r UpsertTenantRequest) ToInsertParams() database.InsertTenantParams {
	id := r.ID.UUID
	if id == uuid.Nil {
		id = uuid.New()
	}

	var slug pgtype.Text
	if r.Slug != nil {
		slug = pgtype.Text{String: *r.Slug, Valid: true}
	}

	disableUpload := false
	if r.DisableClientUpload != nil {
		disableUpload = *r.DisableClientUpload
	}

	includeInAll := true
	if r.IncludeInAll != nil {
		includeInAll = *r.IncludeInAll
	}

	return database.InsertTenantParams{
		ID:                  id,
		Slug:                slug,
		Name:                r.Name,
		DisableClientUpload: disableUpload,
		IncludeInAll:        includeInAll,
		Branding:            r.marshalBranding(),
	}
}

// ToUpdateParams converts the request for an existing tenant.
// Nil fields produce NULL → COALESCE keeps the existing value.
func (r UpsertTenantRequest) ToUpdateParams() database.UpdateTenantParams {
	var slug pgtype.Text
	if r.Slug != nil {
		slug = pgtype.Text{String: *r.Slug, Valid: true}
	}

	var name pgtype.Text
	if r.Name != "" {
		name = pgtype.Text{String: r.Name, Valid: true}
	}

	var disableUpload pgtype.Bool
	if r.DisableClientUpload != nil {
		disableUpload = pgtype.Bool{Bool: *r.DisableClientUpload, Valid: true}
	}

	var includeInAll pgtype.Bool
	if r.IncludeInAll != nil {
		includeInAll = pgtype.Bool{Bool: *r.IncludeInAll, Valid: true}
	}

	return database.UpdateTenantParams{
		ID:                  r.ID.UUID,
		Slug:                slug,
		Name:                name,
		DisableClientUpload: disableUpload,
		IncludeInAll:        includeInAll,
		Branding:            r.marshalBranding(),
	}
}
