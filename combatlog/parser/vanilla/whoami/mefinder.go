package whoami

import (
	"errors"
	"fmt"
	"io"
	"time"

	"github.com/Emyrk/chronicle/combatlog/parser/lines"
	"github.com/Emyrk/chronicle/combatlog/parser/merge"
	"github.com/Emyrk/chronicle/combatlog/parser/types"
	"github.com/Emyrk/chronicle/combatlog/parser/types/combatant"
	"github.com/Emyrk/chronicle/combatlog/parser/types/unitinfo"
)

const (
	// Addon needs to more quickly announce the player's identity to reduce this.
	lineLimit = 3000
)

type scanLine struct {
	Ts      time.Time
	Content string
}
type meFinder struct {
	Scan merge.Scan

	buffer []scanLine
}

func FindMe(liner *lines.Liner, scan merge.Scan) (merge.Scan, *SharedMe, int, error) {
	finder := &meFinder{
		Scan:   scan,
		buffer: make([]scanLine, 0),
	}

	lineCount := 0
	for {
		ts, content, err := scan()
		if err != nil {
			if errors.Is(err, io.EOF) {
				return nil, nil, lineCount, fmt.Errorf("reached end of log without finding me within %d lines", lineCount)
			}
			return nil, nil, lineCount, err
		}

		finder.buffer = append(finder.buffer, scanLine{
			Ts:      ts,
			Content: content,
		})

		lineCount++
		if lineCount > lineLimit {
			return nil, nil, lineCount, fmt.Errorf("cannot find me within %d lines", lineLimit)
		}

		if _, ok := combatant.IsCombatant(content); ok {
			cmbt, err := combatant.ParseCombatantInfo(liner.RealmClockInfo(), content)
			if err != nil {
				continue // Do not fatal on init
			}

			if cmbt.IsMe() {
				return finder.scan, &SharedMe{me: types.Unit{
					Name: cmbt.Name,
					Gid:  cmbt.Guid,
				}}, lineCount, nil
			}
		}

		if _, ok := unitinfo.IsUnitInfo(content); ok {
			ui, err := unitinfo.ParseUnitInfo(liner.RealmClockInfo(), content)
			if err != nil {
				continue // Do not fatal on init
			}

			if ui.IsMe() {
				return finder.scan, &SharedMe{me: types.Unit{
					Name: ui.Name,
					Gid:  ui.Guid,
				}}, lineLimit, nil
			}
		}
	}
}

func (m *meFinder) scan() (time.Time, string, error) {
	if len(m.buffer) > 0 {
		line := m.buffer[0]
		m.buffer = m.buffer[1:]
		return line.Ts, line.Content, nil
	}
	return m.Scan()
}
