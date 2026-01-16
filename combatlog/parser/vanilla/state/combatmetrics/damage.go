package combatmetrics

import (
	"context"
	"fmt"
	"time"

	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/Emyrk/chronicle/combatlog/parser/types"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
)

type DamageSummary struct {
	Units map[guid.GUID]*Unit
}

func NewDamageSummary() *DamageSummary {
	return &DamageSummary{
		Units: make(map[guid.GUID]*Unit),
	}
}

func (s *DamageSummary) Unit(id guid.GUID) *Unit {
	if _, ok := s.Units[id]; !ok {
		s.Units[id] = &Unit{
			DamageDone:  make(map[string]*Ability),
			DamageTaken: make(map[string]*Ability),
		}
	}
	return s.Units[id]
}

func (s *DamageSummary) Process(m messages.Message) error {
	switch data := m.(type) {
	case messages.Damage:
		target := s.Unit(data.Target)
		taken := target.Taken(data.SourceName())
		taken.AddDamage(data)

		if data.Caster != nil {
			caster := s.Unit(*data.Caster)
			done := caster.Done(data.SourceName())
			done.AddDamage(data)
			return nil
		}

		return nil
	case messages.Heal:
		return nil
	case messages.ResourceChange:
		return nil
	default:
		return fmt.Errorf("unsupported message type: %T", m)
	}
}

type Unit struct {
	DamageDone  map[string]*Ability
	DamageTaken map[string]*Ability
}

type Ability struct {
	Total   int64
	Hit     int64
	Crit    int64
	Miss    int64
	Dodge   int64
	Immune  int64
	Parried int64

	// Partial resists and other stuff?
	Other int64
}

func (u *Unit) Taken(source string) *Ability {
	if u.DamageTaken[source] == nil {
		u.DamageTaken[source] = &Ability{}
	}
	return u.DamageTaken[source]
}

func (u *Unit) Done(ability string) *Ability {
	if u.DamageDone[ability] == nil {
		u.DamageDone[ability] = &Ability{}
	}
	return u.DamageDone[ability]
}

func (a *Ability) AddDamage(m messages.Damage) {
	a.Total += int64(m.Amount)
	if m.HitType.Has(types.HitTypeMiss) {
		a.Miss++
	} else if m.HitType.Has(types.HitTypeCrit) {
		a.Crit++
	} else if m.HitType.Has(types.HitTypeHit) {
		a.Hit++
	} else if m.HitType.Has(types.HitTypeDodge) {
		a.Dodge++
	} else if m.HitType.Has(types.HitTypeImmune) {
		a.Immune++
	} else if m.HitType.Has(types.HitTypeParry) {
		a.Parried++
	} else {
		a.Other++
	}
}

func (met *Metrics) DamageSummary(ctx context.Context, start, end time.Time) (*DamageSummary, error) {
	summary := NewDamageSummary()

	err := met.Range(start, end, func(m messages.Message) error {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		return summary.Process(m)
	})
	if err != nil {
		return summary, err
	}
	return summary, nil
}
