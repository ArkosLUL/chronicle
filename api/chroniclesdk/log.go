package chroniclesdk

import (
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/riverqueue/river/rivertype"
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

type WoWLogGroupState struct {
	WoWLogGroup

	Status JobStatus `json:"status"`
}

type JobStatus struct {
	ID          int64                    `json:"id"`
	State       rivertype.JobState       `json:"state"`
	CreatedAt   time.Time                `json:"created_at"`
	ScheduledAt time.Time                `json:"scheduled_at"`
	AttemptedAt *time.Time               `json:"attempted_at"`
	FinalizedAt *time.Time               `json:"finalized_at"`
	Errors      []rivertype.AttemptError `json:"errors"`
	Kind        string                   `json:"kind"`
}
