package chronparser

import (
	"context"
	"fmt"
	"time"

	"github.com/Emyrk/chronicle/combatlog/parser/types"
	"github.com/Emyrk/chronicle/combatlog/parser/types/unitinfo"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
	"github.com/Emyrk/chronicle/internal/ptr"
)

func (p *Parser) unitInfo(ctx context.Context, ts time.Time, m *Matched) ([]messages.Message, error) {
	id := m.Guid()
	isPlayer := m.Int64() == 1
	name := m.String()
	canCooperate := m.Int64() == 1
	owner := m.OptionalGuid()
	buffs, err := unitinfo.ParseBuffs(m.String())
	if err != nil {
		return nil, fmt.Errorf("unit buffs: %w", err)
	}
	level := m.Int64()
	_ = m.skip // TODO: Challenges
	_ = m.skip // Max health

	return set(&messages.Unit{
		MessageBase: messages.Base(ts),
		Info: unitinfo.Info{
			Seen:         ts,
			Guid:         id,
			IsPlayer:     isPlayer,
			Name:         name,
			CanCooperate: canCooperate,
			Owner:        owner,
			Buffs:        buffs,
			Level:        int32(level),
			Challenges:   nil,
		},
	})
}

// 1771542038|SWING|0xF130002C3600BE05|0x000000000001C80A|52|2|1|1|0|0|0
func (p *Parser) swing(ctx context.Context, ts time.Time, m *Matched) ([]messages.Message, error) {
	caster := m.Guid()
	target := m.Guid()
	amount := int32(m.Int64())
	info := m.HitInfo()
	victimState := VictimState(m.Int64())
	subDamage := m.Int32s()
	blocked := int32(m.Int64())
	absorbed := int32(m.Int64())
	resisted := int32(m.Int64())

	if err := m.Error(); err != nil {
		return nil, err
	}

	for _, d := range subDamage {
		amount += d
	}

	return set(&messages.Damage{
		MessageBase:     messages.Base(ts),
		SpellName:       ptr.Ref("Auto Attack"),
		Caster:          ptr.Ref(caster),
		Target:          target,
		HitType:         HitType(info, victimState),
		Amount:          amount,
		School:          types.PhysicalSchool,
		Trailer:         Trailer(blocked, absorbed, resisted),
		EnvironmentType: nil,
	}, nil)
}

// 1771542037|HEAL|0x000000000001C80A|0x000000000001C80A|27805|507|0|0
func (p *Parser) heal(ctx context.Context, ts time.Time, m *Matched) ([]messages.Message, error) {
	target := m.Guid()
	caster := m.Guid()
	spellID := int(m.Int64())
	amount := int32(m.Int64())
	crit := m.Int64() == 1
	periodic := m.Int64() == 1

	hit := types.HitTypeHit
	if crit {
		hit = types.HitTypeCrit
	}
	if periodic {
		hit |= types.HitTypePeriodic
	}

	if err := m.Error(); err != nil {
		return nil, err
	}

	spell, err := p.wowDB.Spell(spellID)
	if err != nil {
		return nil, err
	}

	return set(&messages.Heal{
		MessageBase: messages.Base(ts),
		Caster:      caster,
		Target:      target,
		SpellName:   spell.Name(),
		SpellData:   spell,
		Amount:      amount,
		HitType:     hit,
	})
}

func set(m ...messages.Message) ([]messages.Message, error) {
	return m, nil
}
