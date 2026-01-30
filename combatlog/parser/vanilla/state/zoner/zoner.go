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

func (l *Location) Process(z messages.Zone) bool {
	if z.Name == "" {
		// Ignore empty zones
		return false
	}

	if l.Zone.Equal(z.Zone) {
		// Zone unchanged
		return false
	}
	l.Zone = z.Zone
	return true
}
