package chroniclesdk

import (
	"time"

	"github.com/google/uuid"
)

type ChronicleEncounterEvents struct {
	EncounterID uuid.UUID `json:"encounter_id"`
	Type        string    `json:"type"`
	Payload     []byte    `json:"payload"`
	StartTime   time.Time `json:"start_time"`
}
