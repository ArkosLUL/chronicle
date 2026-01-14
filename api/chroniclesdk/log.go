package chroniclesdk

import (
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type WoWLogGroup struct {
	ID        uuid.UUID          `json:"id"`
	Owner     uuid.UUID          `json:"owner"`
	CreatedAt pgtype.Timestamptz `json:"created_at"`
	UpdatedAt pgtype.Timestamptz `json:"updated_at"`

	Files            []WoWLogFile `json:"files"`
	ProcessingOutput any          `json:"processing_output,omitempty"`
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

type WoWInstance struct {
	ID         uuid.UUID `json:"id"`
	RealmID    uuid.UUID `json:"realm_id"`
	LogGroupID uuid.UUID `json:"log_group_id"`
	Name       string    `json:"name"`
}

type WoWEncounter struct {
	ID         uuid.UUID `json:"id"`
	InstanceID uuid.UUID `json:"instance_id"`
	Boss       bool      `json:"boss"`
	Name       string    `json:"name"`
	Kill       bool      `json:"kill"`
	StartTime  time.Time `json:"start_time"`
	EndTime    time.Time `json:"end_time"`
}

type WoWLogGroupState struct {
	WoWLogGroup

	Status JobStatus `json:"status"`
}

type WoWParsedLogJobOutput struct {
	InstanceFailures map[string]string   `json:"instance_failures"`
	Instances        []WoWParsedInstance `json:"instances"`
}

type WoWParsedInstance struct {
	WoWInstance
	Encounters []WoWEncounter `json:"encounters"`
}
