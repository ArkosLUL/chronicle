package character

import (
	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/data/critters"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters/period"
)

var _ Character = (*Critter)(nil)

// Critter should not have any meaningful activity, so this is a no-op implementation.
type Critter struct {
	id guid.GUID
}

func NewCritterCharacter(id guid.GUID, _ *Characters) (Character, bool) {
	ok := critters.IsCritter(id)
	if !ok {
		return nil, false
	}

	return &Critter{
		id: id,
	}, true
}

func (c Critter) ID() guid.GUID {
	return c.id
}

func (c Critter) String() string {
	return "critter"
}

func (c Critter) Process(m messages.Message) error {
	return nil
}

func (c Critter) Periods() []period.Period {
	return []period.Period{}
}
func (c Critter) CurrentPeriod() (period.Period, bool) {
	return period.Period{}, false
}

func (c Critter) RecentlySlain(m messages.Message) bool {
	return false
}

func (c Critter) IsActive() bool {
	return false
}
