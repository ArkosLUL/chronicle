package azerothcore

import (
	"context"
	"io"
	"log/slog"
	"strings"
	"time"

	"github.com/Emyrk/chronicle/combatlog/parser/azerothcore/synthetic"
	"github.com/Emyrk/chronicle/combatlog/parser/types"
	"github.com/Emyrk/chronicle/combatlog/parser/types/combatant"
	"github.com/Emyrk/chronicle/combatlog/parser/types/realm"
	"github.com/Emyrk/chronicle/combatlog/parser/types/unitinfo"
	"github.com/Emyrk/chronicle/combatlog/parser/types/zone"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters/registry"
	"github.com/Emyrk/chronicle/combatlog/parser/wotlk"
	"github.com/Emyrk/chronicle/database/gamedb"
)

// Parser wraps the WotLK parser and handles Chronicle-specific extension
// events (CHRONICLE_UNIT_INFO, etc.) that the base WotLK parser skips as
// UnparsedLine. This gives a clean extension point for AzerothCore logs.
type Parser struct {
	inner  *wotlk.Parser
	logger *slog.Logger
	gear   gamedb.GearResolver
}

// New creates an AzerothCore parser that wraps a WotLK parser with unix
// millisecond timestamps enabled and CHRONICLE_* event handling.
func New(ctx context.Context, logger *slog.Logger, r io.Reader, wowDB gamedb.GameDB, gear gamedb.GearResolver, reg *registry.Registry) (*Parser, error) {
	inner, err := wotlk.New(ctx, logger, r, wowDB, gear, reg)
	if err != nil {
		return nil, err
	}

	p := &Parser{inner: inner, logger: logger, gear: gear}

	inner.WithEventHook("CHRONICLE_HEADER", p.parseHeader)
	inner.WithEventHook("CHRONICLE_ZONE_INFO", p.parseZoneInfo)
	inner.WithEventHook("CHRONICLE_COMBATANT_INFO", p.parseCombatantInfo)
	inner.WithEventHook("CHRONICLE_UNIT_INFO", p.parseUnitInfo)
	inner.WithEventHook("CHRONICLE_UNIT_EVADE", p.parseUnitEvade)
	inner.WithEventHook("CHRONICLE_UNIT_COMBAT", p.parseUnitCombat)

	// Replace the WoTLK synthetics with our own.
	// A lot of the context comes from the logs now.
	inner.SetSynthetics(synthetic.New(ctx, logger, wowDB))
	inner.SetUnixMillisMode(true)
	return p, nil
}

// Advance reads the next line, delegates to the inner WotLK parser, then
// post-processes to convert any CHRONICLE_* UnparsedLine into typed messages.
func (p *Parser) Advance(ctx context.Context) ([]messages.Message, error) {
	msgs, err := p.inner.Advance(ctx)
	if err != nil {
		return nil, err
	}
	return msgs, nil
}

// DetailedTimes delegates to the inner parser for timing metrics.
func (p *Parser) DetailedTimes() map[string]time.Duration {
	return p.inner.DetailedTimes()
}

// parseHeader converts a CHRONICLE_HEADER line into a messages.Realm.
//
// Fields: "realmName", "version", build
func (p *Parser) parseHeader(ts time.Time, m *wotlk.Matched, _ string) ([]messages.Message, error) {
	realmName := m.String()
	version := m.String()
	build := m.Int32()

	if m.Error() != nil {
		p.logger.Warn("failed to parse CHRONICLE_HEADER", "error", m.Error())
		return nil, nil
	}

	return []messages.Message{
		&messages.Realm{
			MessageBase: messages.Base(ts),
			Info: realm.Info{
				Seen:      ts,
				RealmName: realmName,
				Version:   version,
				Build:     int(build),
			},
		},
	}, nil
}

// parseZoneInfo converts a CHRONICLE_ZONE_INFO line into a messages.Zone.
//
// Fields: "zoneName", mapId, instanceId, "instanceType"
func (p *Parser) parseZoneInfo(ts time.Time, m *wotlk.Matched, _ string) ([]messages.Message, error) {
	zoneName := m.String()
	_ = m.Uint32() // mapId — zone.Zone has no field for it
	instanceID := m.Uint32()
	instanceType := m.String()

	if m.Error() != nil {
		p.logger.Warn("failed to parse CHRONICLE_ZONE_INFO", "error", m.Error())
		return nil, nil
	}

	return []messages.Message{
		&messages.Zone{
			MessageBase: messages.Base(ts),
			Zone: zone.Zone{
				Seen:         ts,
				Name:         strings.ToLower(zoneName),
				InstanceID:   instanceID,
				InstanceType: instanceType,
				IsInstance:   true,
			},
		},
	}, nil
}

// parseCombatantInfo converts a CHRONICLE_COMBATANT_INFO line into a messages.Combatant.
//
// Fields: playerGUID, "name", "class", "race", gender, level, "guild", "gearString", "talentString"
func (p *Parser) parseCombatantInfo(ts time.Time, m *wotlk.Matched, _ string) ([]messages.Message, error) {
	id := m.Guid()
	name := m.String()
	classStr := m.String()
	raceStr := m.String()
	genderInt := m.Int32()
	_ = m.Int32() // level — combatant.Combatant has no level field
	guildName := m.String()
	gearStr := m.String()
	talentStr := m.String()

	if m.Error() != nil {
		p.logger.Warn("failed to parse CHRONICLE_COMBATANT_INFO", "error", m.Error())
		return nil, nil
	}

	heroClass, err := types.ParseHeroClasses(classStr)
	if err != nil {
		heroClass = types.HeroClassesUNKNOWN
	}

	heroRace, err := types.ParseHeroRaces(raceStr)
	if err != nil {
		heroRace = types.HeroRacesUnknown
	}

	// C++ getGender(): 0=Male, 1=Female, 2=None
	// Go HeroGender:   0=NotSet, 1=Unknown, 2=Male, 3=Female
	var gender types.HeroGender
	switch genderInt {
	case 0:
		gender = types.HeroGenderMale
	case 1:
		gender = types.HeroGenderFemale
	default:
		gender = types.HeroGenderUnknown
	}

	var guild *combatant.Guild
	if guildName != "" {
		guild = &combatant.Guild{Name: guildName}
	}

	var gear []combatant.GearItem
	if gearStr != "" {
		gear = combatant.ParseGear(strings.Split(gearStr, "&"))
		if p.gear != nil {
			p.gear.ResolveGear(gear)
		}
	}

	var talents *combatant.Talents
	if talentStr != "" {
		var err error
		talents, err = combatant.ParseTalents(talentStr)
		if err != nil {
			p.logger.Warn("failed to parse talents in CHRONICLE_COMBATANT_INFO", "error", err)
		}
	}

	return []messages.Message{
		&messages.Combatant{
			MessageBase: messages.Base(ts),
			Combatant: combatant.Combatant{
				Name:       name,
				Guid:       id,
				Seen:       ts,
				HeroClass:  heroClass,
				Gender:     gender,
				Race:       heroRace,
				Guild:      guild,
				GearSetups: gear,
				Talents:    talents,
			},
		},
	}, nil
}

// parseUnitEvade converts a CHRONICLE_UNIT_EVADE line into a messages.UnitEvade.
//
// Fields: guid, "name", why (uint8 EvadeReason)
func (p *Parser) parseUnitEvade(ts time.Time, m *wotlk.Matched, _ string) ([]messages.Message, error) {
	id := m.Guid()
	name := m.String()
	why := m.Int32() // uint8 on C++ side, parsed as int32

	if m.Error() != nil {
		p.logger.Warn("failed to parse CHRONICLE_UNIT_EVADE", "error", m.Error())
		return nil, nil
	}

	return []messages.Message{
		&messages.UnitEvade{
			MessageBase: messages.Base(ts),
			UnitGUID:    id,
			UnitName:    name,
			Reason:      uint8(why),
		},
	}, nil
}

// parseUnitCombat converts a CHRONICLE_UNIT_COMBAT line into a messages.UnitCombatEnter.
//
// Fields: unitGuid, "unitName", victimGuid, "victimName"
func (p *Parser) parseUnitCombat(ts time.Time, m *wotlk.Matched, _ string) ([]messages.Message, error) {
	unitGUID := m.Guid()
	unitName := m.String()
	victimGUID := m.Guid()
	victimName := m.String()

	if m.Error() != nil {
		p.logger.Warn("failed to parse CHRONICLE_UNIT_COMBAT", "error", m.Error())
		return nil, nil
	}

	return []messages.Message{
		&messages.UnitCombatEnter{
			MessageBase: messages.Base(ts),
			UnitGUID:    unitGUID,
			UnitName:    unitName,
			VictimGUID:  victimGUID,
			VictimName:  victimName,
		},
	}, nil
}

// parseUnitInfo converts a CHRONICLE_UNIT_INFO line into a messages.Unit.
//
// Fields: guid, "name", level, unitFlags (hex, currently always 0x0), ownerGuid, maxHealth
func (p *Parser) parseUnitInfo(ts time.Time, m *wotlk.Matched, _ string) ([]messages.Message, error) {
	id := m.Guid()
	name := m.String()
	level := m.Int32()
	_ = m.HexUint32() // unitFlags — currently always 0, use GUID for player detection
	owner := m.OptionalGuid()
	_ = m.Int32() // maxHealth — consume to advance cursor, unitinfo.Info has no field for it

	if m.Error() != nil {
		p.logger.Warn("failed to parse CHRONICLE_UNIT_INFO", "error", m.Error())
		return nil, nil
	}

	info := unitinfo.Info{
		Seen:     ts,
		Guid:     id,
		IsPlayer: id.IsPlayer(),
		Name:     name,
		Level:    level,
	}
	if owner != nil && !owner.IsZero() {
		info.Owner = owner
	}

	return []messages.Message{
		&messages.Unit{
			MessageBase: messages.Base(ts),
			Info:        info,
		},
	}, nil
}
