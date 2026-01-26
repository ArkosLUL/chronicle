package encounterevents

import (
	"time"

	"github.com/Emyrk/chronicle/api/chronicleproto"
	"github.com/Emyrk/chronicle/api/chronicleproto/types2proto"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
)

type EncounterEventsInProgress EncounterEvents

type EncounterEvents struct {
	Damage chronicleproto.DamageReport
	cnter  int32
}

func New() *EncounterEventsInProgress {
	return &EncounterEventsInProgress{
		Damage: chronicleproto.DamageReport{
			Damages: make([]*chronicleproto.Damage, 0),
		},
	}
}

func (e *EncounterEvents) Marshal() ([]byte, error) {

	return nil, nil
}

func (e *EncounterEventsInProgress) Finalize(start time.Time) (*EncounterEvents, error) {
	for i := range e.Damage.Damages {
		e.Damage.Damages[i].Meta.OffsetMilli = e.Damage.Damages[i].Meta.OffsetMilli - start.UnixMilli()
	}

	return (*EncounterEvents)(e), nil
}

func (e *EncounterEventsInProgress) Process(m messages.Message) error {
	switch ty := m.(type) {
	case messages.Damage:
		e.Damage.Damages = append(e.Damage.Damages, types2proto.Damage(e.nextIndex(), ty))
	}
	return nil
}

func (e *EncounterEventsInProgress) nextIndex() int32 {
	e.cnter++
	return e.cnter - 1
}
