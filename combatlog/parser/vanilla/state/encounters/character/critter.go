package character

import (
	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/data/critters"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters/period"
)

var _ Character = (*Critter)(nil)

// Critter should not have any meaningful activity, so this is a no-op implementation.
type Critter struct {
	NeverActive
}

func NewCritterCharacter(id guid.GUID, _ *Characters) (Character, bool) {
	ok := critters.IsCritter(id)
	if !ok {
		return nil, false
	}

	return &Critter{
		NeverActive{id: id},
	}, true
}

func (c Critter) String() string {
	return "critter"
}

func (c Critter) SetPeriodHook(hook period.Hook) {
}
