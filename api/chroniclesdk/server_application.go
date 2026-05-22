package chroniclesdk

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// ModificationRequest represents a pending, approved, or rejected change.
type ModificationRequest struct {
	ID            uuid.UUID       `json:"id"`
	ApplicationID uuid.UUID       `json:"application_id"`
	Type          string          `json:"type"`
	ParentID      *uuid.UUID      `json:"parent_id,omitempty"`
	Payload       json.RawMessage `json:"payload"`
	Status        string          `json:"status"`
	AdminNote     *string         `json:"admin_note,omitempty"`
	ReviewedBy    *uuid.UUID      `json:"reviewed_by,omitempty"`
	ReviewedAt    *time.Time      `json:"reviewed_at,omitempty"`
	ResourceID    *uuid.UUID      `json:"resource_id,omitempty"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
}

// ServerApplication response includes all modification requests.
type ServerApplication struct {
	ID          uuid.UUID             `json:"id"`
	InitiatedBy uuid.UUID            `json:"initiated_by"`
	Username    string                `json:"username"`
	Name        string                `json:"name"`
	TenantID    uuid.UUID             `json:"tenant_id"`
	Tenant      Tenant                `json:"tenant"`
	Requests    []ModificationRequest `json:"requests"`
	CanReview   bool                  `json:"can_review"`
	CreatedAt   time.Time             `json:"created_at"`
	UpdatedAt   time.Time             `json:"updated_at"`
}

// CreateServerApplicationRequest is sent to create a new application.
// Initial modification requests are created from the fields here.
type CreateServerApplicationRequest struct {
	Name        string                `json:"name"`
	DisplayName string                `json:"display_name"`
	Tagline     string                `json:"tagline"`
	Tags        []string              `json:"tags"`
	Servers     []CreateServerRequest `json:"servers"`
}

type CreateServerRequest struct {
	Name        string               `json:"name"`
	Description string               `json:"description"`
	URL         *string              `json:"url"`
	Realms      []CreateRealmRequest `json:"realms"`
}

type CreateRealmRequest struct {
	Name        string  `json:"name"`
	Description string  `json:"description"`
	URL         *string `json:"url"`
}

// CreateModificationRequestPayload is sent to create/upsert a mod request.
type CreateModificationRequestPayload struct {
	Type     string          `json:"type"`
	ParentID *uuid.UUID      `json:"parent_id,omitempty"`
	Payload  json.RawMessage `json:"payload"`
}

// ReviewModificationRequest is sent by the admin to approve/reject.
type ReviewModificationRequest struct {
	AdminNote *string `json:"admin_note,omitempty"`
}

// ApplicationAdminEntry is returned when listing application admins.
type ApplicationAdminEntry struct {
	UserID    uuid.UUID `json:"user_id"`
	Username  string    `json:"username"`
	DiscordID string    `json:"discord_id,omitempty"`
}

// ModifyApplicationAdminRequest is sent to add an admin.
type ModifyApplicationAdminRequest struct {
	UserID uuid.UUID `json:"user_id"`
}

// --- Payload shapes (used for unmarshalling in apply methods) ---

type CorePayload struct {
	Name        string   `json:"name"`
	DisplayName string   `json:"display_name"`
	Tagline     string   `json:"tagline"`
	Tags        []string `json:"tags"`
}

type SlugPayload struct {
	Slug string `json:"slug"`
}

type DescriptionPayload struct {
	Description string `json:"description"`
	WebsiteURL  string `json:"website_url"`
}

type LogosPayload struct {
	SquareLogo       string `json:"square_logo"`
	LogoWide         string `json:"logo_wide"`
	Favicon          string `json:"favicon"`
	BackgroundBanner string `json:"background_banner"`
}

type ThemePayload struct {
	Theme map[string]string `json:"theme"`
}

type ServerPayload struct {
	Name        string     `json:"name"`
	Description string     `json:"description"`
	URL         *string    `json:"url"`
	// ResourceID is set when editing an existing server (the wow_server UUID).
	// If nil, a new server is created on approval.
	ResourceID  *uuid.UUID `json:"resource_id,omitempty"`
}

type RealmPayload struct {
	Name        string     `json:"name"`
	Description string     `json:"description"`
	URL         *string    `json:"url"`
	// ResourceID is set when editing an existing realm (the wow_server_realm UUID).
	// If nil, a new realm is created on approval.
	ResourceID  *uuid.UUID `json:"resource_id,omitempty"`
}

// SettingsPayload contains tenant boolean settings.
type SettingsPayload struct {
	IncludeInAll        bool `json:"include_in_all"`
	DisableClientUpload bool `json:"disable_client_upload"`
	Discoverable        bool `json:"discoverable"`
}

// DeleteServerPayload requests removal of a server from the tenant.
type DeleteServerPayload struct {
	ResourceID uuid.UUID `json:"resource_id"`
	Name       string    `json:"name"` // For display purposes.
}

// DeleteRealmPayload requests removal of a realm.
type DeleteRealmPayload struct {
	ResourceID uuid.UUID `json:"resource_id"`
	Name       string    `json:"name"` // For display purposes.
}
