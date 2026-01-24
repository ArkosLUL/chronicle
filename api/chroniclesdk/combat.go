package chroniclesdk

import (
	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/google/uuid"
)

type EncounterDamageSummary struct {
	EncounterID      uuid.UUID `json:"encounter_id"`
	UnitGuid         guid.GUID `json:"unit_guid"`
	UnitName         string    `json:"unit_name"`
	DamageDoneTotal  int64     `json:"damage_done_total"`
	DamageTakenTotal int64     `json:"damage_taken_total"`
	// DamageDoneAbilities is a map of damage done to a unit, keyed by the target's GUID string.
	DamageDoneAbilities  map[GUIDString]map[string]Ability `json:"damage_done_abilities"`
	DamageTakenAbilities map[GUIDString]map[string]Ability `json:"damage_taken_abilities"`
	IsPlayer             bool                              `json:"is_player"`
	OwnerGuid            *guid.GUID                        `json:"owner_guid"`
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
