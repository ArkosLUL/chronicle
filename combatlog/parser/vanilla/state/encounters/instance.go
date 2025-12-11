package encounters

import (
	"github.com/Emyrk/chronicle/combatlog/parser/types/zone"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
)

// Instance represents a dungeon or raid instance
type Instance interface {
	// Name returns the instance name (e.g., "Scarlet Monastery Cathedral")
	Name() string

	// MatchesZone checks if this instance handles the given zone
	MatchesZone(z zone.Zone) bool

	// Process handles a message for this instance
	Process(m messages.Message) error

	// Remove this in favor of parsed characters
	CharactersList() Characters
}
