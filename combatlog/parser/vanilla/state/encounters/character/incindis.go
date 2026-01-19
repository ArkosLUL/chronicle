package character

import (
	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters/period"
)

var _ Character = (*SpawnOfIncindis)(nil)

// SpawnOfIncindis should not have any meaningful activity, so this is a no-op implementation.
type SpawnOfIncindis struct {
	id guid.GUID
}

func NewSpawnOfIncindisCharacter(id guid.GUID, _ *Characters) (Character, bool) {
	if !id.IsCreature() {
		return nil, false
	}

	if entry, ok := id.GetEntry(); !ok || entry != 52148 {
		return nil, false
	}

	return &SpawnOfIncindis{
		id: id,
	}, true
}

func (c SpawnOfIncindis) ID() guid.GUID {
	return c.id
}

func (c SpawnOfIncindis) String() string {
	return "Spawn Of Incindis"
}

func (c SpawnOfIncindis) Process(m messages.Message) error {
	return nil
}

func (c SpawnOfIncindis) Periods() []period.Period {
	return []period.Period{}
}
func (c SpawnOfIncindis) CurrentPeriod() (period.Period, bool) {
	return period.Period{}, false
}

func (c SpawnOfIncindis) RecentlySlain(m messages.Message) bool {
	return false
}

func (c SpawnOfIncindis) IsActive() bool {
	return false
}
