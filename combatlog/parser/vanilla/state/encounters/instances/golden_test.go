package instances_test

import (
	"compress/gzip"
	"context"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"

	"github.com/Emyrk/chronicle/combatlog/consumers"
	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/Emyrk/chronicle/combatlog/parser/logfile"
	"github.com/Emyrk/chronicle/combatlog/parser/merge"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/parserv2"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters/instances"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/unitdb"
	"github.com/Emyrk/chronicle/database/gamedb"
	"github.com/stretchr/testify/require"
)

var updateGolden = flag.Bool("update", false, "Update golden files")

type goldenFixture struct {
	name string

	// v1: directory containing WoWCombatLog.txt and WoWRawCombatLog.txt
	v1Dir string
	// v2: single gzipped combat log in pipe-delimited format
	v2File string
}

var goldenFixtures = []goldenFixture{
	{name: "scholotutor", v1Dir: "../character/testdata/scholotutor"},
	{name: "emeraldsanctum", v2File: "testdata/emeraldsanctum/combatlog-4cee0c7f-7a88-422d-9a01-615dbfc17ebd.txt.gz"},
}

func TestGoldenEncounters(t *testing.T) {
	t.Parallel()
	t.Skip("skipping")

	for _, fx := range goldenFixtures {
		t.Run(fx.name, func(t *testing.T) {
			t.Parallel()

			output := parseFixture(t, fx)
			goldenPath := fmt.Sprintf("testdata/%s.golden", fx.name)

			if *updateGolden {
				err := os.MkdirAll("testdata", 0o755)
				require.NoError(t, err)
				err = os.WriteFile(goldenPath, []byte(output), 0o644)
				require.NoError(t, err)
				t.Logf("Updated golden file: %s", goldenPath)
				return
			}

			expected, err := os.ReadFile(goldenPath)
			require.NoError(t, err, "golden file missing — run with -update")
			require.Equal(t, strings.TrimSpace(string(expected)), strings.TrimSpace(output))
		})
	}
}

// advancer is satisfied by both v1 (*vanilla.Parser) and v2 (*parserv2.Parser).
type advancer interface {
	consumers.Advancer
}

func parseFixture(t *testing.T, fx goldenFixture) string {
	t.Helper()

	ctx := context.Background()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	var p advancer
	if fx.v2File != "" {
		p = openV2Parser(t, logger, fx.v2File)
	} else {
		p = openV1Parser(t, ctx, logger, fx.v1Dir)
	}

	state := encounters.New(ctx, logger)
	c := consumers.New(logger, state)
	require.NoError(t, c.ConsumeAll(ctx, p))

	var out strings.Builder
	for _, inst := range state.Instances {
		finalized, err := inst.Finalize(ctx)
		require.NoError(t, err)
		serializeInstance(&out, inst.Name(), finalized, state.Units)
	}
	return out.String()
}

// openV1Parser opens a v1 dual-file fixture (WoWRawCombatLog.txt + WoWCombatLog.txt).
func openV1Parser(t *testing.T, ctx context.Context, logger *slog.Logger, dir string) *vanilla.Parser {
	t.Helper()

	rawFile, err := os.Open(dir + "/WoWRawCombatLog.txt")
	require.NoError(t, err)
	t.Cleanup(func() { _ = rawFile.Close() })

	logFile, err := os.Open(dir + "/WoWCombatLog.txt")
	require.NoError(t, err)
	t.Cleanup(func() { _ = logFile.Close() })

	m := merge.NewMerger(logger)
	liner, scans, err := m.LineScanner(ctx, nil, logfile.New(nil, rawFile), logfile.New(nil, logFile))
	require.NoError(t, err)

	return vanilla.NewFromScanner(logger, liner, scans, nil)
}

// openV2Parser opens a v2 gzipped combat log fixture. Requires assets/Spell.dbc.
func openV2Parser(t *testing.T, logger *slog.Logger, path string) *parserv2.Parser {
	t.Helper()

	// The v2 parser requires a spell database.
	dbcPath := filepath.Join("..", "..", "..", "..", "..", "..", "assets", "Spell.dbc")
	if _, err := os.Stat(dbcPath); os.IsNotExist(err) {
		t.Skipf("assets/Spell.dbc not found at %s, skipping v2 fixture", dbcPath)
	}
	db, err := gamedb.New(context.Background(), gamedb.Options{SpellsDBCPath: dbcPath})
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })

	f, err := os.Open(path)
	require.NoError(t, err)
	t.Cleanup(func() { _ = f.Close() })

	var reader io.Reader = f
	if strings.HasSuffix(path, ".gz") {
		gz, err := gzip.NewReader(f)
		require.NoError(t, err)
		t.Cleanup(func() { _ = gz.Close() })
		reader = gz
	}

	p, err := parserv2.New(logger, reader, db)
	require.NoError(t, err)
	return p
}

func serializeInstance(w *strings.Builder, name string, fi *instances.FinalizedInstance, units *unitdb.Units) {
	fmt.Fprintf(w, "Instance: %s\n", name)
	if fi.Realm != nil {
		fmt.Fprintf(w, "Realm: %s\n", fi.Realm.RealmName)
	}
	fmt.Fprintf(w, "Encounters: %d\n", len(fi.Encounters))

	for i, enc := range fi.Encounters {
		fmt.Fprintf(w, "---\n")

		// For trash encounters, the name depends on map iteration order
		// in Finalize() and is non-deterministic. Stabilize it by using
		// the first unit name alphabetically from the fight's hostiles.
		encName := enc.Name
		if !enc.Boss {
			names := make([]string, 0, len(enc.Combat.Hostiles))
			for g := range enc.Combat.Hostiles {
				if info, ok := units.Get(g); ok {
					names = append(names, info.Name)
				}
			}
			sort.Strings(names)
			if len(names) > 0 {
				encName = names[0]
			}
		}

		fmt.Fprintf(w, "[%d] %s %q (kill=%s, boss=%v)\n",
			i, enc.Type, encName, enc.KillType, enc.Boss)
		fmt.Fprintf(w, "  Start: %s End: %s\n",
			enc.Combat.Start.Format("15:04:05.000"),
			enc.Combat.End.Format("15:04:05.000"))

		// Sort hostiles by GUID string for deterministic output.
		type hostileEntry struct {
			guidStr string
			id      guid.GUID
			fight   instances.CharacterFight
		}
		hostiles := make([]hostileEntry, 0, len(enc.Combat.Hostiles))
		for g, cf := range enc.Combat.Hostiles {
			hostiles = append(hostiles, hostileEntry{
				guidStr: g.String(),
				id:      g,
				fight:   cf,
			})
		}
		sort.Slice(hostiles, func(i, j int) bool {
			return hostiles[i].guidStr < hostiles[j].guidStr
		})

		fmt.Fprintf(w, "  Hostiles (%d):\n", len(hostiles))
		for _, h := range hostiles {
			unitName := h.guidStr
			if info, ok := units.Get(h.id); ok {
				unitName = fmt.Sprintf("%s (%s)", info.Name, h.guidStr)
			}
			fmt.Fprintf(w, "    %s periods=%d", unitName, len(h.fight.Activity))
			if len(h.fight.Activity) > 0 {
				lastPeriod := h.fight.Activity[len(h.fight.Activity)-1]
				fmt.Fprintf(w, " endState=%s", lastPeriod.EndState)
			}
			fmt.Fprintf(w, "\n")

			// Print each activity period for detailed regression detection.
			for pi, p := range h.fight.Activity {
				startStr := "<nil>"
				if p.Start != nil {
					startStr = p.Start.Timestamp.Date().Format("15:04:05.000")
				}
				endStr := "<nil>"
				if p.End != nil {
					endStr = p.End.Timestamp.Date().Format("15:04:05.000")
				}
				fmt.Fprintf(w, "      [%d] %s -> %s (%s)\n", pi, startStr, endStr, p.EndState)
			}
		}

		fmt.Fprintf(w, "  PlayerDeaths: %d\n", len(enc.Combat.PlayerDeaths))

		if len(enc.Remaining) > 0 {
			remaining := make([]string, 0, len(enc.Remaining))
			for _, g := range enc.Remaining {
				remaining = append(remaining, g.String())
			}
			sort.Strings(remaining)
			fmt.Fprintf(w, "  Remaining: %s\n", strings.Join(remaining, ", "))
		}
	}
}
