package character

import (
	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters/period"
)

var _ Character = (*NeverActive)(nil)

// NeverActive should not have any meaningful activity, so this is a no-op implementation.
type NeverActive struct {
	id guid.GUID
}

func (c NeverActive) ID() guid.GUID {
	return c.id
}

func (c NeverActive) String() string {
	return "never_active"
}
func (c NeverActive) Process(m messages.Message) error {
	return nil
}
func (c NeverActive) Died(reason string, m messages.Message) {}
func (c NeverActive) Periods() []period.Period {
	return []period.Period{}
}
func (c NeverActive) CurrentPeriod() (period.Period, bool) {
	return period.Period{}, false
}
func (c NeverActive) RecentlySlain(m messages.Message) bool {
	return false
}
func (c NeverActive) IsActive() bool {
	return false
}
