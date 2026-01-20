package instances

import (
	"context"

	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/Emyrk/chronicle/combatlog/parser/types/zone"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters/character"
)

type Identity struct {
	Hostile bool
	// EncounterName, if set, will be used to identify a named encounter.
	EncounterName string
	// Boss indicates if the unit is considered a boss for encounter purposes.
	Boss bool
}

// Instance represents a dungeon or raid instance
type Instance interface {
	// Name returns the instance name (e.g., "Scarlet Monastery Cathedral")
	Name() string

	// MatchesZone checks if this instance handles the given zone
	MatchesZone(z zone.Zone) bool

	// Process handles a message for this instance
	Process(m messages.Message) error

	// CharactersList returns the list of characters in this instance and their
	// associated activity and additional data.
	CharactersList() map[guid.GUID]character.Character
	// IdentifyUnit returns any hard coded identity information for the given GUID in the
	// instance.
	IdentifyUnit(id guid.GUID) Identity
	// Zone returns the zone of this instance
	Zone() zone.Zone

	// Fights returns all completed fights plus any current fight in progress.
	// This is populated live during message processing.
	Fights() []Fight
	Finalize(ctx context.Context) (*FinalizedInstance, error)
}

type Identifier struct {
	byEntryId map[uint32]Identity
}

func NewIdentifier(byEntryId map[uint32]Identity) *Identifier {
	return &Identifier{
		byEntryId: byEntryId,
	}
}

func (i *Identifier) IdentifyUnit(id guid.GUID) Identity {
	if id.IsPlayer() {
		return Identity{Hostile: false}
	}

	entryID, ok := id.GetEntry()
	if !ok {
		return Identity{Hostile: false}
	}

	identity, exists := i.byEntryId[entryID]
	if !exists {
		return Identity{Hostile: false}
	}
	return identity
}
