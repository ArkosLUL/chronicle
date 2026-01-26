package encounterevents

import (
	"time"

	"github.com/Emyrk/chronicle/api/chronicleproto"
	"github.com/Emyrk/chronicle/api/chronicleproto/types2proto"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
	"github.com/Emyrk/chronicle/database"
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

func (e *EncounterEvents) InsertParams() ([]database.InsertLogEncounterEventsParams, error) {
	params := make([]database.InsertLogEncounterEventsParams, 1)
	return params, nil
}

func (e *EncounterEventsInProgress) Finalize(start time.Time) (*EncounterEvents, error) {
	return (*EncounterEvents)(e), nil
}

func (e *EncounterEventsInProgress) Process(m messages.Message) error {
	switch ty := m.(type) {
	case messages.Damage:
		AddToBuilder(e.Damage, ty, e.nextIndex(), types2proto.Damage)
	}
	return nil
}

func (e *EncounterEventsInProgress) nextIndex() int32 {
	e.cnter++
	return e.cnter - 1
}
