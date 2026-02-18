package chroniclesdk

import (
	"time"

	"github.com/google/uuid"
)

type Session struct {
	UserID               uuid.UUID   `json:"user_id"`
	SessionID            uuid.UUID   `json:"session_id"`
	Roles                []string    `json:"roles"`
	MaxStorageBytes      int64       `json:"max_storage_bytes"`
	ConsumedStorageBytes int64       `json:"consumed_storage_bytes"`
	Preferences          Preferences `json:"preferences"`
}

type Preferences struct {
	HelpfulHints bool `json:"helpful_hints"`
}

type User struct {
	ID                     uuid.UUID `json:"id"`
	Username               string    `json:"username"`
	Email                  string    `json:"email"`
	Roles                  []string  `json:"roles"`
	CreatedAt              time.Time `json:"created_at"`
	UpdatedAt              time.Time `json:"updated_at"`
	MaxStorageBytes        int64     `json:"max_storage_bytes"`
	MaxStorageBytesUpdated time.Time `json:"max_storage_bytes_updated"`
	ConsumedStorageBytes   int64     `json:"consumed_storage_bytes"`
}

type AdminUsersResponse struct {
	Users []User `json:"users"`
}

type AdminLogsResponse struct {
	Logs       []AdminLog `json:"logs"`
	HasMore    bool       `json:"has_more"`
	TotalCount int        `json:"total_count"`
}

type AdminLog struct {
	ID            uuid.UUID `json:"id"`
	OwnerID       uuid.UUID `json:"owner_id"`
	OwnerName     string    `json:"owner_name"`
	Description   string    `json:"description"`
	CreatedAt     string    `json:"created_at"`
	State         string    `json:"state"`
	SizeBytes     int64     `json:"size_bytes"`
	InstanceNames []string  `json:"instance_names"`
}

type SetUserDataLimitRequest struct {
	MaxStorageBytes int64 `json:"max_storage_bytes"`
}
