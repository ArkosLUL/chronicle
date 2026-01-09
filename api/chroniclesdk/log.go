package chroniclesdk

import (
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type WoWLogGroup struct {
	ID        uuid.UUID          `json:"id"`
	Owner     uuid.UUID          `json:"owner"`
	CreatedAt pgtype.Timestamptz `json:"created_at"`
	UpdatedAt pgtype.Timestamptz `json:"updated_at"`

	Files []WoWLogFile `json:"files"`
}

type WoWLogFile struct {
  ID        uuid.UUID          `json:"id"`
  Owner     uuid.UUID          `json:"owner"`
  WowLogID  uuid.UUID          `json:"wow_log_id"`
  Hash      string             `json:"hash"`
  SizeBytes int64              `json:"size_bytes"`
  MimeType  string             `json:"mime_type"`
  CreatedAt pgtype.Timestamptz `json:"created_at"`
  UpdatedAt pgtype.Timestamptz `json:"updated_at"`
}
