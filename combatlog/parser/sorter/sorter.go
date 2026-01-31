package sorter

import (
	"bufio"
	"context"
	"io"
	"log/slog"
	"slices"
	"time"

	"github.com/Emyrk/chronicle/combatlog/parser/lines"
	"github.com/Emyrk/chronicle/combatlog/parser/types/combatant"
	"github.com/Emyrk/chronicle/combatlog/parser/types/realmclock"
	"github.com/Emyrk/chronicle/combatlog/parser/types/unitinfo"
	"github.com/Emyrk/chronicle/combatlog/parser/types/zone"
)

type SortSummary struct {
	Earliest time.Time
	Latest   time.Time
	Total    int
}

type logLine struct {
	Date    time.Time
	Content string
	idx     int64
}

// SortLogs reads log lines from input, sorts them by timestamp, and writes them to output.
func SortLogs(ctx context.Context, logger *slog.Logger, input io.Reader, output io.Writer) (SortSummary, error) {
	sum := SortSummary{}
	buffer := make([]logLine, 0)
	var firstRealmClock *realmclock.Info

	// Use original timestamps for sorting
	liner := lines.NewLiner().WithoutTimeAdjustments()
	sc := bufio.NewScanner(input)
	c := int64(0)
	for sc.Scan() {
		if ctx.Err() != nil {
			return sum, ctx.Err()
		}

		txt := sc.Text()
		ts, content, err := liner.Line(txt)
		if err != nil {
			logger.Warn("skipping failed line", slog.String("line", txt), slog.String("error", err.Error()))
			continue
		}
		buffer = append(buffer, logLine{
			Date:    ts,
			Content: content,
			idx:     c,
		})
		c++

		if firstRealmClock == nil && liner.RealmClockInfo() != nil {
			firstRealmClock = liner.RealmClockInfo()
		}

		if ts.Before(sum.Earliest) || sum.Earliest.IsZero() {
			sum.Earliest = ts
		}

		if ts.After(sum.Latest) {
			sum.Latest = ts
		}
		sum.Total++
	}

	// Sort primarily by timestamp. Then prioritize:
	// 1. Zone info lines, zone changes context for everything else
	// 2. Unit info lines, unit db should be poplulated asap
	// 3. Combatant lines, same idea as above
	// Finally, keep the original order for lines with identical timestamps and types
	slices.SortFunc(buffer, func(a, b logLine) int {
		am, bm := a.Date.UnixMilli(), b.Date.UnixMilli()
		if am != bm {
			return int(am - bm)
		}

		_, acl := realmclock.IsClockInfo(a.Content)
		_, bcl := realmclock.IsClockInfo(b.Content)
		clc := compareBooleans(acl, bcl)
		if clc != 0 {
			return clc
		}

		_, az := zone.IsZoneInfo(a.Content)
		_, bz := zone.IsZoneInfo(b.Content)
		cz := compareBooleans(az, bz)
		if cz != 0 {
			return cz
		}

		_, au := unitinfo.IsUnitInfo(a.Content)
		_, bu := unitinfo.IsUnitInfo(b.Content)
		cu := compareBooleans(au, bu)
		if cu != 0 {
			return cu
		}

		_, ac := combatant.IsCombatant(a.Content)
		_, bc := combatant.IsCombatant(b.Content)
		cc := compareBooleans(ac, bc)
		if cc != 0 {
			return cc
		}

		return int(a.idx - b.idx)
	})

	// First thing we do is insert some heading logs
	if len(buffer) > 0 && firstRealmClock != nil {
		_, _ = output.Write([]byte(
			// Knock some time off the first to guarantee it's first
			liner.FmtLine(
				buffer[0].Date.Add(time.Second*-10),
				firstRealmClock.String(),
			),
		))
		_, _ = output.Write([]byte("\n"))
	}

	for _, line := range buffer {
		if ctx.Err() != nil {
			return sum, ctx.Err()
		}

		_, err := output.Write([]byte(liner.FmtLine(line.Date, line.Content)))
		if err != nil {
			return sum, err
		}
		_, _ = output.Write([]byte("\n"))
	}

	return sum, nil
}

func compareBooleans(a, b bool) int {
	if a == b {
		return 0
	}
	// True should be less than false so it's sorted first
	if a && !b {
		return -1
	}
	return 1
}
