package zoner

import (
	"github.com/Emyrk/chronicle/combatlog/parser/types/zone"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
)

type Location struct {
	zone.Zone
}

func NewLocation() *Location {
	return &Location{
		Zone: zone.Zone{},
	}
}

func (l *Location) Process(z messages.Zone) zone.ZoneChangeResult {
	if z.Name == "" {
		// Ignore empty zones
		return zone.NoChange
	}

	if !l.Equal(z.Zone) {
		l.Zone = z.Zone
		return zone.ZoneChanged
	}

	// Same zone (name + instanceID match). Check for difficulty changes.
	if z.HasDifficulty() {
		if l.HasDifficulty() && !l.DifficultyEquals(z.Zone) {
			// Difficulty was already set and now differs → new instance needed.
			l.Zone = z.Zone
			return zone.DifficultyChanged
		}
		if !l.HasDifficulty() {
			// Adopt late-arriving difficulty info in place.
			l.DifficultyIndex = z.DifficultyIndex
			l.DifficultyName = z.DifficultyName
			l.MaxPlayers = z.MaxPlayers
			l.DynamicDifficulty = z.DynamicDifficulty
			l.SubZone = z.SubZone
			return zone.InfoUpdated
		}
	}
	return zone.NoChange
}
