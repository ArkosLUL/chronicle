package chroniclesdk

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// RetentionPolicy is a retention policy scoped to a server or realm.
type RetentionPolicy struct {
	ID        uuid.UUID  `json:"id"`
	ServerID  *uuid.UUID `json:"server_id"`
	RealmID   *uuid.UUID `json:"realm_id"`
	Enabled   bool       `json:"enabled"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
	Rules     []RetentionRule `json:"rules,omitempty"`
}

// RetentionRule is an ordered rule within a retention policy.
type RetentionRule struct {
	ID          uuid.UUID        `json:"id"`
	PolicyID    uuid.UUID        `json:"policy_id"`
	Priority    int              `json:"priority"`
	Action      string           `json:"action"` // "keep" | "delete"
	Conditions  json.RawMessage  `json:"conditions"`
	Description string           `json:"description"`
	CreatedAt   time.Time        `json:"created_at"`
}

// UpsertRetentionPolicyRequest creates or updates a retention policy.
type UpsertRetentionPolicyRequest struct {
	ServerID *uuid.UUID `json:"server_id"`
	RealmID  *uuid.UUID `json:"realm_id"`
	Enabled  bool       `json:"enabled"`
}

// UpsertRetentionRuleRequest creates or updates a retention rule.
type UpsertRetentionRuleRequest struct {
	Priority    int             `json:"priority"`
	Action      string          `json:"action"`
	Conditions  json.RawMessage `json:"conditions"`
	Description string          `json:"description"`
}

// RetentionPreviewRequest triggers a dry-run of retention evaluation.
type RetentionPreviewRequest struct {
	RealmID  *uuid.UUID `json:"realm_id,omitempty"`
	ServerID *uuid.UUID `json:"server_id,omitempty"`
}

// RetentionPreviewResponse is the result of a dry-run evaluation.
type RetentionPreviewResponse struct {
	TotalEvaluated int                    `json:"total_evaluated"`
	ToDelete       []RetentionPreviewItem `json:"to_delete"`
	ToKeep         []RetentionPreviewItem `json:"to_keep"`
	NoMatch        []RetentionPreviewItem `json:"no_match"`
}

// RetentionPreviewItem describes a single instance's retention evaluation.
type RetentionPreviewItem struct {
	InstanceID   uuid.UUID  `json:"instance_id"`
	InstanceName string     `json:"instance_name"`
	EndTime      time.Time  `json:"end_time"`
	MatchedRule  *string    `json:"matched_rule,omitempty"`
}

// RetentionRunRequest triggers a manual retention run.
type RetentionRunRequest struct {
	DryRun bool `json:"dry_run"`
}
