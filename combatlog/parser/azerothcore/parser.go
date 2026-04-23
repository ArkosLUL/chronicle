package azerothcore

import (
	"context"
	"io"
	"log/slog"
	"strings"
	"time"

	"github.com/Emyrk/chronicle/combatlog/parser/azerothcore/synthetic"
	"github.com/Emyrk/chronicle/combatlog/parser/types/unitinfo"
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
}

// New creates an AzerothCore parser that wraps a WotLK parser with unix
// millisecond timestamps enabled and CHRONICLE_* event handling.
func New(ctx context.Context, logger *slog.Logger, r io.Reader, wowDB gamedb.GameDB, gear gamedb.GearResolver, reg *registry.Registry) (*Parser, error) {
	inner, err := wotlk.New(ctx, logger, r, wowDB, gear, reg)
	if err != nil {
		return nil, err
	}

	// Replace the WoTLK synthetics with our own.
	// A lot of the context comes from the logs now.
	inner.SetSynthetics(synthetic.New(ctx, logger, wowDB))
	inner.SetUnixMillisMode(true)
	return &Parser{inner: inner, logger: logger}, nil
}

// Advance reads the next line, delegates to the inner WotLK parser, then
// post-processes to convert any CHRONICLE_* UnparsedLine into typed messages.
func (p *Parser) Advance(ctx context.Context) ([]messages.Message, error) {
	msgs, err := p.inner.Advance(ctx)
	if err != nil {
		return nil, err
	}
	return p.postProcess(msgs), nil
}

// DetailedTimes delegates to the inner parser for timing metrics.
func (p *Parser) DetailedTimes() map[string]time.Duration {
	return p.inner.DetailedTimes()
}

func (p *Parser) postProcess(msgs []messages.Message) []messages.Message {
	result := make([]messages.Message, 0, len(msgs))
	for _, msg := range msgs {
		unparsed, ok := msg.(*messages.UnparsedLine)
		if !ok {
			result = append(result, msg)
			continue
		}

		if replacement := p.tryParseChronicleEvent(unparsed); replacement != nil {
			result = append(result, replacement...)
		} else {
			result = append(result, msg)
		}
	}
	return result
}

func (p *Parser) tryParseChronicleEvent(unparsed *messages.UnparsedLine) []messages.Message {
	content := unparsed.Content
	if !strings.Contains(content, "CHRONICLE_") {
		return nil
	}

	ts, event, m, err := wotlk.ParseLineUnixMillis(content)
	if err != nil {
		return nil
	}

	switch event {
	case "CHRONICLE_UNIT_INFO":
		return p.parseUnitInfo(ts, m)
	// Future: CHRONICLE_HEADER, CHRONICLE_ZONE_INFO, CHRONICLE_COMBATANT_INFO
	default:
		return nil
	}
}

// parseUnitInfo converts a CHRONICLE_UNIT_INFO line into a messages.Unit.
//
// Fields: guid, "name", level, unitFlags (hex, currently always 0x0), ownerGuid, maxHealth
func (p *Parser) parseUnitInfo(ts time.Time, m *wotlk.Matched) []messages.Message {
	id := m.Guid()
	name := m.String()
	level := m.Int32()
	_ = m.HexUint32() // unitFlags — currently always 0, use GUID for player detection
	owner := m.OptionalGuid()
	_ = m.Int32() // maxHealth — consume to advance cursor, unitinfo.Info has no field for it

	if m.Error() != nil {
		p.logger.Warn("failed to parse CHRONICLE_UNIT_INFO", "error", m.Error())
		return nil
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
	}
}
