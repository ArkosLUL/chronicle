package parserv2

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"log/slog"
	"time"

	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/parseerrors"
	"github.com/Emyrk/chronicle/database/gamedb"
)

type Parser struct {
	logger  *slog.Logger
	wowDB   *gamedb.WoWDB
	scanner *bufio.Scanner

	lastDate time.Time
}

func New(logger *slog.Logger, r io.Reader, wowDB *gamedb.WoWDB) *Parser {
	return &Parser{
		logger:  logger,
		wowDB:   wowDB,
		scanner: bufio.NewScanner(r),
	}
}

func (p *Parser) Advance(ctx context.Context) (_ []messages.Message, final error) {
	ok := p.scanner.Scan()
	if !ok {
		return nil, io.EOF
	}
	next := p.scanner.Text()
	ts, event, m, err := ParseLine(next)
	if err != nil {
		return nil, err
	}
	defer func() {
		if final == nil && m.Error() != nil {
			final = m.Error()
		}
	}()

	if !p.lastDate.IsZero() && ts.Before(p.lastDate.Add(-time.Second)) {
		return nil, parseerrors.AsFatalError(fmt.Errorf("log dates went backwards: last %v, current %v", p.lastDate, ts))
	}
	p.lastDate = ts

	switch event {
	case "ZONE_INFO":
		return p.zoneInfo(ctx, ts, m)
	case "UNIT_INFO":
		return p.unitInfo(ctx, ts, m)
	case "SWING":
		return p.swing(ctx, ts, m)
	case "HEAL":
		return p.heal(ctx, ts, m)
	case "DEATH":
		return p.slain(ctx, ts, m)
	case "SPELL_DMG":
		return p.spell_dmg(ctx, ts, m)
	}

	return messages.Unparsed(ts, next), nil
}
