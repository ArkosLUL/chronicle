package damagemetric

import (
	"time"

	"github.com/Emyrk/chronicle/combatlog/parser/guid"
)

type Summary struct {
	Start time.Time
	End   time.Time

	// TotalDealt damage dealt by each unit from each source (like a spell)
	TotalDealt map[guid.GUID]map[string]int32
}

func (d *Damage) Summary(start time.Time, end time.Time) (Summary, error) {
	summary := Summary{
		Start:      start,
		End:        end,
		TotalDealt: make(map[guid.GUID]map[string]int32),
	}

	err := d.Range(start, end, func(e Event) {
		if e.Source != nil {
			if summary.TotalDealt[*e.Source] == nil {
				summary.TotalDealt[*e.Source] = make(map[string]int32)
			}
			summary.TotalDealt[*e.Source][e.From] += e.Amount
		}
	})
	if err != nil {
		return summary, err
	}

	return summary, nil
}
