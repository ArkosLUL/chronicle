package chroniclesdk

import (
	"encoding/json"
	"time"

	"github.com/riverqueue/river/rivertype"
)

type JobStatus struct {
	ID          int64                    `json:"id"`
	Attempt     int                      `json:"attempt"`
	MaxAttempts int                      `json:"max_attempts"`
	State       rivertype.JobState       `json:"state"`
	CreatedAt   time.Time                `json:"created_at"`
	ScheduledAt time.Time                `json:"scheduled_at"`
	AttemptedAt *time.Time               `json:"attempted_at"`
	FinalizedAt *time.Time               `json:"finalized_at"`
	Errors      []rivertype.AttemptError `json:"errors"`
	Kind        string                   `json:"kind"`
	Output      json.RawMessage          `json:"output,omitempty"`
}
