package sdk

import "github.com/google/uuid"

type Session struct {
	UserID    uuid.UUID `json:"user_id"`
	SessionID uuid.UUID `json:"session_id"`
}
