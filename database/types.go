package database

import (
	"database/sql/driver"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"golang.org/x/xerrors"
)

type GetWoWLogGroupsByOwnerRow2 struct {
	WoWLogGroup WoWLogGroup   `db:"wo_wlog_group" json:"wo_wlog_group"`
	Files       []SlimLogFile `db:"files" json:"files"`
}

type SlimLogFile struct {
	ID        uuid.UUID          `json:"id"`
	Hash      string             `json:"hash"`
	SizeBytes int64              `json:"size_bytes"`
	MimeType  string             `json:"mime_type"`
	CreatedAt pgtype.Timestamptz `json:"created_at"`
	UpdatedAt pgtype.Timestamptz `json:"updated_at"`
}

func (t *SlimLogFile) Scan(src interface{}) error {
	switch v := src.(type) {
	case string:
		return json.Unmarshal([]byte(v), &t)
	case []byte:
		return json.Unmarshal(v, &t)
	case json.RawMessage:
		return json.Unmarshal(v, &t)
	}

	return xerrors.Errorf("unexpected type %T", src)
}

func (t SlimLogFile) Value() (driver.Value, error) {
	return json.Marshal(t)
}
