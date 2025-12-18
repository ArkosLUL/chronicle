package vanilla

import (
	"fmt"
	"sort"
	"strings"
	"time"
)

type Metrics struct {
	PreProcessDuration time.Duration
	TotalParseDuration time.Duration
	TotalLinesParsed   int64

	// UnmatchedTime is the total time spent attempting to match lines that did not result in a successful parse.
	UnmatchedTime  time.Duration
	MatchingTime   map[string]time.Duration
	UnmatchingTime map[string]time.Duration
}

func (m Metrics) Format() string {
	var sb strings.Builder

	writeKV := func(label string, value any) {
		fmt.Fprintf(&sb, "%-24s %v\n", label+":", value)
	}

	writeKV("Pre-process duration", m.PreProcessDuration)
	writeKV("Total parse duration", m.TotalParseDuration)
	writeKV("Total lines parsed", m.TotalLinesParsed)
	writeKV("Unmatched time", m.UnmatchedTime)

	// Helper to write duration maps sorted by largest duration
	writeDurationMap := func(title string, data map[string]time.Duration) {
		if len(data) == 0 {
			return
		}

		type entry struct {
			key string
			d   time.Duration
		}

		entries := make([]entry, 0, len(data))
		for k, d := range data {
			entries = append(entries, entry{key: k, d: d})
		}

		sort.Slice(entries, func(i, j int) bool {
			return entries[i].d > entries[j].d
		})

		sb.WriteString("\n" + title + ":\n")
		for _, e := range entries {
			fmt.Fprintf(&sb, "  %-20s %v\n", e.key+":", e.d)
		}
	}

	writeDurationMap("Matching time by rule", m.MatchingTime)
	writeDurationMap("Unmatching time by rule", m.UnmatchingTime)

	return sb.String()
}
