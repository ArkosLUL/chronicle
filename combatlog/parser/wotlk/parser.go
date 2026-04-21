package wotlk

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"log/slog"
	"time"

	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/parseerrors"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters/registry"
	"github.com/Emyrk/chronicle/combatlog/parser/wotlk/synthetic"
	"github.com/Emyrk/chronicle/database/gamedb"
	"github.com/Emyrk/chronicle/database/gamedb/chrondbc"
)

type Parser struct {
	logger  *slog.Logger
	wowDB   gamedb.SpellFetcher
	scanner *bufio.Scanner

	lastDate    time.Time
	guidNames   *GUIDNames
	synthetics  *synthetic.Synthetic
	itemFetcher gamedb.GearResolver
	baseYear    int

	lineParseDur  time.Duration
	syntheticsDur time.Duration

	missedSpells map[chrondbc.SpellID]int
}

func New(ctx context.Context, logger *slog.Logger, r io.Reader, wowDB gamedb.GameDB, gear gamedb.GearResolver, reg *registry.Registry) (*Parser, error) {
	if wowDB == nil {
		return nil, fmt.Errorf("wowDB cannot be nil")
	}
	gn := NewGUIDNames()
	return &Parser{
		logger:       logger,
		wowDB:        wowDB,
		scanner:      bufio.NewScanner(r),
		guidNames:    gn,
		synthetics:   synthetic.New(ctx, logger, wowDB, reg, gn),
		itemFetcher:  gear,
		baseYear:     time.Now().Year(),
		missedSpells: make(map[chrondbc.SpellID]int),
	}, nil
}

// SetBaseYear overrides the year used for timestamps (WotLK logs omit the year).
func (p *Parser) SetBaseYear(year int) {
	p.baseYear = year
}

func (p *Parser) DetailedTimes() map[string]time.Duration {
	times := map[string]time.Duration{
		"parser.line_parse":  p.lineParseDur,
		"parser.synthetics":  p.syntheticsDur,
	}
	for k, v := range p.synthetics.DetailedTimes() {
		times[k] = v
	}
	return times
}

func (p *Parser) Advance(ctx context.Context) ([]messages.Message, error) {
	now := time.Now()
	msgs, err := p.advance(ctx)
	p.lineParseDur += time.Since(now)
	if err != nil {
		return nil, err
	}

	now = time.Now()
	msgs, err = p.synthetics.ProcessMessages(msgs)
	p.syntheticsDur += time.Since(now)
	if err != nil {
		return nil, fmt.Errorf("processing synthetics: %w", err)
	}

	return msgs, nil
}

func (p *Parser) advance(_ context.Context) (_ []messages.Message, final error) {
	ok := p.scanner.Scan()
	if !ok {
		return nil, io.EOF
	}
	next := p.scanner.Text()
	if next == "" {
		return messages.Unparsed(time.Time{}, next), nil
	}

	ts, event, m, err := ParseLine(next)
	if err != nil {
		return nil, err
	}
	defer func() {
		if final == nil && m.Error() != nil {
			final = m.Error()
		}
	}()

	// Apply base year — WotLK timestamps have no year.
	ts = ts.AddDate(p.baseYear, 0, 0)

	if !p.lastDate.IsZero() && ts.Before(p.lastDate.Add(-time.Second)) {
		return nil, parseerrors.AsFatalError(fmt.Errorf("log dates went backwards: last %v, current %v", p.lastDate, ts))
	}
	p.lastDate = ts

	return p.dispatch(ts, event, m, next)
}

func (p *Parser) Spell(id chrondbc.SpellID) (*chrondbc.Spell, error) {
	return p.wowDB.Spell(id)
}

// MissedSpells returns spell IDs that were not found in the DBC, with lookup counts.
func (p *Parser) MissedSpells() map[chrondbc.SpellID]int {
	return p.missedSpells
}
