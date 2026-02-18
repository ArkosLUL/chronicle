package database

import (
	"database/sql/driver"
	"encoding/json"
	"time"

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

type Ability struct {
	Total   int64 `json:"total"`
	Hit     int64 `json:"hit_count"`
	Crit    int64 `json:"crit_count"`
	Miss    int64 `json:"miss_count"`
	Dodge   int64 `json:"dodge_count"`
	Immune  int64 `json:"immune_count"`
	Parried int64 `json:"parry_count"`

	// Partial resists and other stuff?
	Other int64 `json:"other_count"`
}

func (a *Ability) Scan(src interface{}) error {
	switch v := src.(type) {
	case string:
		return json.Unmarshal([]byte(v), &a)
	case []byte:
		return json.Unmarshal(v, &a)
	case json.RawMessage:
		return json.Unmarshal(v, &a)
	}

	return xerrors.Errorf("unexpected type %T", src)
}

func (a Ability) Value() (driver.Value, error) {
	return json.Marshal(a)
}

type Periods []Period

type Period struct {
	Start      *PeriodMoment `json:"start,omitempty"`
	End        *PeriodMoment `json:"end,omitempty"`
	LastActive *PeriodMoment `json:"last_active,omitempty"`

	Slain bool `json:"slain"`
}

type PeriodMoment struct {
	Timestamp   time.Time       `json:"timestamp"`
	Reason      string          `json:"reason"`
	MessageType string          `json:"message_type,omitempty"`
	Message     json.RawMessage `json:"message,omitempty"`
}

func (a *Periods) Scan(src interface{}) error {
	switch v := src.(type) {
	case string:
		return json.Unmarshal([]byte(v), &a)
	case []byte:
		return json.Unmarshal(v, &a)
	case json.RawMessage:
		return json.Unmarshal(v, &a)
	}

	return xerrors.Errorf("unexpected type %T", src)
}

func (a Periods) Value() (driver.Value, error) {
	if a == nil {
		return "[]", nil
	}
	b, err := json.Marshal(a)
	if err != nil {
		return nil, err
	}
	return string(b), nil
}

type Video struct {
	URL        string           `json:"url"`
	ExportedAt time.Time        `json:"exported_at"`
	Results    []VideoTimestamp `json:"results"`
}

type VideoTimestamp struct {
	VideoTimeSeconds int    `json:"video_time_seconds"`
	RawOCR           string `json:"raw_ocr"`
	// Need to convert to timezone, is like "17:56:08"
	ServerTime string `json:"server_time"`
	UTCTime    string `json:"utc_time"`
	Confidence int    `json:"confidence"`
}

func (t *Video) Scan(src interface{}) error {
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

func (t Video) Value() (driver.Value, error) {
	return json.Marshal(t)
}
