package encounterevents

import (
	"fmt"
	"time"

	"github.com/Emyrk/chronicle/api/chronicleproto"
	"github.com/Emyrk/chronicle/api/chronicleproto/types2proto"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
	"github.com/google/uuid"
)

type EncounterEventsInProgress EncounterEvents

type EncounterEvents struct {
	Damage *Builder[messages.Damage, *chronicleproto.Damage]
	cnter  int32

	firsts map[string]time.Time
}

func New() *EncounterEventsInProgress {
	return &EncounterEventsInProgress{
		Damage: NewBuilder[messages.Damage, *chronicleproto.Damage](),
	}
}

func (e *EncounterEventsInProgress) Finalize(merge *Events, encounterID uuid.UUID) error {
	damagePayload, err := e.Damage.Finalize(encounterID)
	if err != nil {
		return fmt.Errorf("finalizing damage events: %w", err)
	}

	merge.Damage = append(merge.Damage, damagePayload...)
	return nil
}

func (e *EncounterEventsInProgress) Process(m messages.Message) error {
	switch ty := m.(type) {
	case messages.Damage:
		err := AddToBuilder(e.Damage, ty, e.nextIndex(), types2proto.Damage)
		if err != nil {
			return fmt.Errorf("damage proto: %w", err)
		}
	}
	return nil
}

func (e *EncounterEventsInProgress) nextIndex() int32 {
	e.cnter++
	return e.cnter - 1
}
