package encounterevents

import (
	"fmt"

	"github.com/Emyrk/chronicle/api/chronicleproto"
	"github.com/Emyrk/chronicle/api/chronicleproto/types2proto"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
	"github.com/google/uuid"
)

type EncounterEventsInProgress EncounterEvents

type EncounterEvents struct {
	Damage         *Builder[messages.Damage, *chronicleproto.Damage]
	Heal           *Builder[messages.Heal, *chronicleproto.Heal]
	ResourceChange *Builder[messages.ResourceChange, *chronicleproto.ResourceChange]
	ExtraAttack    *Builder[messages.ExtraAttack, *chronicleproto.ExtraAttack]
	cnter          int32
}

func New() *EncounterEventsInProgress {
	return &EncounterEventsInProgress{
		Damage:         NewBuilder[messages.Damage, *chronicleproto.Damage](),
		Heal:           NewBuilder[messages.Heal, *chronicleproto.Heal](),
		ResourceChange: NewBuilder[messages.ResourceChange, *chronicleproto.ResourceChange](),
		ExtraAttack:    NewBuilder[messages.ExtraAttack, *chronicleproto.ExtraAttack](),
	}
}

func (e *EncounterEventsInProgress) Finalize(merge *Events, encounterID uuid.UUID) error {
	damagePayload, err := e.Damage.Finalize(encounterID)
	if err != nil {
		return fmt.Errorf("finalizing damage events: %w", err)
	}

	healPayload, err := e.Heal.Finalize(encounterID)
	if err != nil {
		return fmt.Errorf("finalizing heal events: %w", err)
	}

	rcPayload, err := e.ResourceChange.Finalize(encounterID)
	if err != nil {
		return fmt.Errorf("finalizing resource change events: %w", err)
	}

	extraAttack, err := e.ExtraAttack.Finalize(encounterID)
	if err != nil {
		return fmt.Errorf("finalizing extra attack events: %w", err)
	}

	merge.Damage = append(merge.Damage, damagePayload...)
	merge.Healing = append(merge.Healing, healPayload...)
	merge.ResourceChange = append(merge.ResourceChange, rcPayload...)
	merge.ExtraAttack = append(merge.ExtraAttack, extraAttack...)

	return nil
}

func (e *EncounterEventsInProgress) Process(m messages.Message) error {
	switch ty := m.(type) {
	case messages.Damage:
		err := AddToBuilder(e.Damage, ty, e.nextIndex(), types2proto.Damage)
		if err != nil {
			return fmt.Errorf("damage proto: %w", err)
		}
	case messages.Heal:
		err := AddToBuilder(e.Heal, ty, e.nextIndex(), types2proto.Heal)
		if err != nil {
			return fmt.Errorf("heal proto: %w", err)
		}
	case messages.ResourceChange:
		err := AddToBuilder(e.ResourceChange, ty, e.nextIndex(), types2proto.ResourceChange)
		if err != nil {
			return fmt.Errorf("resource change proto: %w", err)
		}
	case messages.ExtraAttack:
		err := AddToBuilder(e.ExtraAttack, ty, e.nextIndex(), types2proto.ExtraAttack)
		if err != nil {
			return fmt.Errorf("extra attack proto: %w", err)
		}
	}
	return nil
}

func (e *EncounterEventsInProgress) nextIndex() int32 {
	e.cnter++
	return e.cnter - 1
}
