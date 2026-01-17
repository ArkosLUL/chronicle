package combatmetrics

import (
	"context"
	"fmt"
	"time"

	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/Emyrk/chronicle/combatlog/parser/types"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
	"github.com/Emyrk/chronicle/database"
	"github.com/Emyrk/chronicle/internal/ptr"
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
			DamageDone:  make(map[string]database.Ability),
			DamageTaken: make(map[string]database.Ability),
		}
	}
	return s.Units[id]
}

func (s *DamageSummary) Process(m messages.Message) error {
	switch data := m.(type) {
	case messages.Damage:
		target := s.Unit(data.Target)
		target.Taken(data)

		if data.Caster != nil {
			caster := s.Unit(*data.Caster)
			caster.Done(data)
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
	TotalDamageDone  int64 `json:"total_damage_done"`
	TotalDamageTaken int64 `json:"total_damage_taken"`

	DamageDone  map[string]database.Ability `json:"damage_done"`
	DamageTaken map[string]database.Ability `json:"damage_taken"`
}

type Ability database.Ability

func (u *Unit) Taken(m messages.Damage) {
	source := m.SourceName()
	if _, ok := u.DamageTaken[source]; !ok {
		u.DamageTaken[source] = database.Ability{}
	}
	u.TotalDamageTaken += (ptr.Ref(Ability(u.DamageTaken[source]))).AddDamage(m)
}

func (u *Unit) Done(m messages.Damage) {
	source := m.SourceName()
	if _, ok := u.DamageDone[source]; !ok {
		u.DamageDone[source] = database.Ability{}
	}
	u.TotalDamageDone += (ptr.Ref(Ability(u.DamageDone[source]))).AddDamage(m)
}

func (a *Ability) AddDamage(m messages.Damage) int64 {
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
	return int64(m.Amount)
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
