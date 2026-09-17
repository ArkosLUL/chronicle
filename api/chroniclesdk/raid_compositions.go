package chroniclesdk

import (
	"time"

	"github.com/google/uuid"
)

// RaidCompEntryKind discriminates the two kinds of slot entries in a saved
// raid composition.
type RaidCompEntryKind string

const (
	RaidCompEntryPlayer      RaidCompEntryKind = "player"
	RaidCompEntryPlaceholder RaidCompEntryKind = "placeholder"
)

// RaidCompEntry is one occupant of a raid composition slot or bench spot.
type RaidCompEntry struct {
	Kind RaidCompEntryKind `json:"kind"`
	// CharacterID is the game_players id when the entry is a guild roster
	// character. Empty for placeholders and standalone imports (e.g.
	// raid-helper sign-ups that matched no roster character).
	CharacterID string `json:"character_id,omitempty"`
	// Name is the display name. Empty for placeholders.
	Name string `json:"name,omitempty"`
	// Class is the WoWHeroClasses enum value ("WARRIOR").
	Class string `json:"class"`
	// Spec is the planned spec display name; empty means unset/any.
	Spec string `json:"spec,omitempty"`
	Note string `json:"note,omitempty"`
}

// RaidCompPlacement pins an entry to a specific board slot.
type RaidCompPlacement struct {
	// Group is the 0-based group index.
	Group int `json:"group"`
	// Slot is the 0-based slot index within the group (0–4).
	Slot  int           `json:"slot"`
	Entry RaidCompEntry `json:"entry"`
}

// RaidCompData is the typed payload of a saved raid composition. The board
// is sparse: slots without a placement are empty.
type RaidCompData struct {
	// Groups is the group count; every group has five slots.
	Groups     int                 `json:"groups"`
	Placements []RaidCompPlacement `json:"placements"`
	Bench      []RaidCompEntry     `json:"bench"`
	// GroupNotes align by index with the groups; missing/short is allowed.
	GroupNotes []string `json:"group_notes,omitempty"`
}

// RaidComposition is a saved raid planner composition. Viewing defaults to
// public (share links); editing is gated by SpiceDB (owner + granted
// editors).
type RaidComposition struct {
	ID      uuid.UUID  `json:"id"`
	UserID  uuid.UUID  `json:"user_id"`
	GuildID *uuid.UUID `json:"guild_id,omitempty"`
	Name    string     `json:"name"`
	Data    RaidCompData `json:"data"`
	// PublicView mirrors the SpiceDB public_viewer wildcard for display.
	PublicView bool      `json:"public_view"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type CreateRaidCompositionRequest struct {
	Name    string       `json:"name"`
	GuildID *uuid.UUID   `json:"guild_id,omitempty"`
	Data    RaidCompData `json:"data"`
}

type UpdateRaidCompositionRequest struct {
	Name    *string       `json:"name,omitempty"`
	GuildID *uuid.UUID    `json:"guild_id,omitempty"`
	Data    *RaidCompData `json:"data,omitempty"`
}

// UpdateRaidCompositionSharingRequest declaratively sets the sharing state:
// the editor list replaces all existing editor grants.
type UpdateRaidCompositionSharingRequest struct {
	PublicView    bool        `json:"public_view"`
	EditorUserIDs []uuid.UUID `json:"editor_user_ids"`
}

type ListRaidCompositionsResponse struct {
	Compositions []RaidComposition `json:"compositions"`
	// Limit is the maximum number of compositions a user may save (per tenant).
	Limit int `json:"limit"`
}
