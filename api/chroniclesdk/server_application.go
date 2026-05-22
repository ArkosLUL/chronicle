package chroniclesdk

import (
	"time"

	"github.com/google/uuid"
)

type ServerApplication struct {
	ID           uuid.UUID              `json:"id"`
	InitiatedBy  uuid.UUID              `json:"initiated_by"`
	Username     string                 `json:"username"`
	Status       string                 `json:"status"`
	Name         string                 `json:"name"`
	TenantID     uuid.UUID              `json:"tenant_id"`
	Tenant       Tenant                 `json:"tenant"`
	FieldReviews map[string]FieldReview `json:"field_reviews"`
	Servers      []ServerApplicationServer `json:"servers"`
	AdminNote    *string                `json:"admin_note"`
	CanReview    bool                   `json:"can_review"`
	CreatedAt    time.Time              `json:"created_at"`
	UpdatedAt    time.Time              `json:"updated_at"`
}

type ServerApplicationServer struct {
	ID          uuid.UUID                `json:"id"`
	Name        string                   `json:"name"`
	Description string                   `json:"description"`
	URL         *string                  `json:"url"`
	Status      string                   `json:"status"`
	AdminNote   *string                  `json:"admin_note"`
	ServerID    *uuid.UUID               `json:"server_id"`
	Realms      []ServerApplicationRealm `json:"realms"`
	CreatedAt   time.Time                `json:"created_at"`
}

type ServerApplicationRealm struct {
	ID          uuid.UUID  `json:"id"`
	Name        string     `json:"name"`
	Description string     `json:"description"`
	URL         *string    `json:"url"`
	Status      string     `json:"status"`
	AdminNote   *string    `json:"admin_note"`
	RealmID     *uuid.UUID `json:"realm_id"`
	CreatedAt   time.Time  `json:"created_at"`
}

type FieldReview struct {
	Status     string     `json:"status"`
	Note       *string    `json:"note"`
	ReviewedAt *time.Time `json:"reviewed_at"`
}

type CreateServerApplicationRequest struct {
	Name        string                `json:"name"`
	DisplayName string                `json:"display_name"`
	Tagline     string                `json:"tagline"`
	Tags        []string              `json:"tags"`
	Servers     []CreateServerRequest `json:"servers"`
}

type CreateServerRequest struct {
	Name        string              `json:"name"`
	Description string              `json:"description"`
	URL         *string             `json:"url"`
	Realms      []CreateRealmRequest `json:"realms"`
}

type CreateRealmRequest struct {
	Name        string  `json:"name"`
	Description string  `json:"description"`
	URL         *string `json:"url"`
}

type UpdateServerApplicationRequest struct {
	Name        *string   `json:"name"`
	DisplayName *string   `json:"display_name"`
	Tagline     *string   `json:"tagline"`
	Description *string   `json:"description"`
	Tags        []string  `json:"tags"`
	Slug        *string   `json:"slug"`
	Branding    *Branding `json:"branding"`
}

type ReviewFieldRequest struct {
	Section string  `json:"section"`
	Status  string  `json:"status"`
	Note    *string `json:"note"`
}

type ReviewServerRequest struct {
	AdminNote *string `json:"admin_note"`
}

type ReviewRealmRequest struct {
	AdminNote *string `json:"admin_note"`
}

type RejectApplicationRequest struct {
	AdminNote *string `json:"admin_note"`
}

type AddServerRequest struct {
	Name        string              `json:"name"`
	Description string              `json:"description"`
	URL         *string             `json:"url"`
	Realms      []CreateRealmRequest `json:"realms"`
}

type AddRealmRequest struct {
	Name        string  `json:"name"`
	Description string  `json:"description"`
	URL         *string `json:"url"`
}
