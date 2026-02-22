package parserv2

import (
	"context"
	"fmt"
	"time"

	"github.com/Emyrk/chronicle/combatlog/parser/types"
	"github.com/Emyrk/chronicle/combatlog/parser/types/unitinfo"
	"github.com/Emyrk/chronicle/combatlog/parser/types/zone"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
	"github.com/Emyrk/chronicle/internal/ptr"
)

func (p *Parser) zoneInfo(ctx context.Context, ts time.Time, m *Matched) ([]messages.Message, error) {
	name := m.String()
	instanceID := uint32(m.Uint64())
	inInstance := m.Int64() == 1
	instanceType := m.String() // none, party, raid, pvp
	isGhost := m.Int64() == 1

	if err := m.Error(); err != nil {
		return nil, err
	}

	return set(&messages.Zone{
		MessageBase: messages.Base(ts),
		Zone: zone.Zone{
			Seen:         ts,
			Name:         name,
			InstanceID:   instanceID,
			Ghost:        isGhost,
			InstanceType: instanceType,
			IsInstance:   inInstance,
		},
	})
}

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

	if err := m.Error(); err != nil {
		return nil, err
	}

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
	info := m.SwingHitInfo()
	victimState := VictimState(m.Int64())
	_ = m.Int64() // Number of damage components probably does not matter
	blocked := int32(m.Int64())
	absorbed := int32(m.Int64())
	resisted := int32(m.Int64())

	if err := m.Error(); err != nil {
		return nil, err
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
	})
}

// 1771542037|HEAL|0x000000000001C80A|0x000000000001C80A|27805|507|0|0
func (p *Parser) heal(ctx context.Context, ts time.Time, m *Matched) ([]messages.Message, error) {
	target := m.Guid()
	caster := m.Guid()
	spell := m.DBCSpellByID(p)
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

// 1771564201000|SPELL_DMG|0xF130002C3800949D|0x000000000001C7AC|22482|67|0,0,0|0|0|2,0,0,0
func (p *Parser) spell_dmg(ctx context.Context, ts time.Time, m *Matched) ([]messages.Message, error) {
	target := m.Guid()
	caster := m.Guid()
	spell := m.DBCSpellByID(p)
	amount := int32(m.Int64())
	mitigated := m.Int32s() // 3 values: blocked, absorbed, resisted
	hitInfo := m.Int64()
	schoolV := m.Int64() // TODO: Map to types.School

	effects := m.Int32s() // effect1, effect2, effect3, auraType

	// TODO: Periodic? Absorbed, resisted?
	hit := types.HitTypeHit
	if hitInfo == 2 {
		hit = types.HitTypeCrit
	}

	if err := m.Error(); err != nil {
		return nil, err
	}

	if len(mitigated) != 3 {
		return nil, fmt.Errorf("expected 3 mitigated values, got %d", len(mitigated))
	}

	if len(effects) != 4 {
		return nil, fmt.Errorf("expected 4 effect values, got %d", len(effects))
	}

	return set(&messages.Damage{
		MessageBase:     messages.Base(ts),
		SpellName:       ptr.Ref(spell.Name()),
		Caster:          ptr.Ref(caster),
		Target:          target,
		HitType:         hit,
		Amount:          amount,
		School:          School(int32(schoolV)),
		Trailer:         nil,
		EnvironmentType: nil,
	})
}

//func (p *Parser) spellStart(_ context.Context, ts time.Time, m *Matched) ([]messages.Message, error) {
//	itemID := m.Int32() // 0 if no item triggered it
//	spellData := m.DBCSpellByID(p)
//	caster := m.Guid()
//	target := m.OptionalGuid() // 0x0000000000000000 if no target
//	castFlags := m.CastFlags()
//	castTime := m.Int32()        // In millis
//	channelDuration := m.Int32() // In millis, 0 if not a channel
//	spellType := m.Int32()       // 0 = normal, 1 = channel, 2 = auto repeating
//	corpseOwner := m.OptionalGuid()
//
//	if err := m.Error(); err != nil {
//		return nil, err
//	}
//
//	var item *int32
//	if itemID != 0 {
//		item = ptr.Ref(itemID)
//	}
//
//	return set(&messages.SpellGo{
//		MessageBase:      messages.Base(ts),
//		ItemID:           item,
//		SpellID:          spellData.ID,
//		SpellData:        spellData,
//		Caster:           caster,
//		Target:           target,
//		Flags:            castFlags,
//		NumTargetsHit:    targetsHit,
//		NumTargetsMissed: numMissed,
//		CorpseOwner:      corpseOwner,
//	})
//}

// spellGo does indicate a spell being landed/missed. These logs also appear as
// SPELL_DMG and "MISS" logs.
func (p *Parser) spellGo(_ context.Context, ts time.Time, m *Matched) ([]messages.Message, error) {
	itemID := m.Int32() // 0 if no item triggered it
	spellData := m.DBCSpellByID(p)
	caster := m.Guid()
	target := m.OptionalGuid() // 0x0000000000000000 if no target
	castFlags := m.CastFlags()
	targetsHit := m.Int32()
	numMissed := m.Int32()
	corpseOwner := m.OptionalGuid()

	if err := m.Error(); err != nil {
		return nil, err
	}

	var item *int32
	if itemID != 0 {
		item = ptr.Ref(itemID)
	}

	return set(&messages.SpellGo{
		MessageBase:      messages.Base(ts),
		ItemID:           item,
		SpellID:          spellData.ID,
		SpellData:        spellData,
		Caster:           caster,
		Target:           target,
		Flags:            castFlags,
		NumTargetsHit:    targetsHit,
		NumTargetsMissed: numMissed,
		CorpseOwner:      corpseOwner,
	})
}

func (p *Parser) slain(_ context.Context, ts time.Time, m *Matched) ([]messages.Message, error) {
	id := m.Guid()

	if err := m.Error(); err != nil {
		return nil, err
	}

	return set(&messages.Slain{
		MessageBase: messages.Base(ts),
		Victim:      id,
		Killer:      nil,
		Attribution: nil,
	})
}

func set(m ...messages.Message) ([]messages.Message, error) {
	return m, nil
}
