package chronicle_test

import (
	"bytes"
	"context"
	"io"
	"log/slog"
	"os"
	"testing"

	"github.com/Emyrk/chronicle/combatlog/consumers"
	"github.com/Emyrk/chronicle/combatlog/parser/sorter"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/parseerrors"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters"
	"github.com/Emyrk/chronicle/internal/leveledlog"
	"github.com/stretchr/testify/require"
)

// benchFixtures defines test fixtures for benchmarks.
// Add larger fixtures from ignoredlogs/ as needed.
var benchFixtures = []struct {
	name string
	path string
}{
	{"majordomo_73lines", "../combatlog/parser/vanilla/state/encounters/character/testdata/majordomo/WoWCombatLog.txt"},
	{"corehound_165lines", "../combatlog/parser/vanilla/state/encounters/character/testdata/corehoundpack/WoWCombatLog.txt"},
	{"sonofhakker_536lines", "../combatlog/parser/vanilla/state/encounters/character/testdata/sonofhakker/WoWCombatLog.txt"},
	{"scholotutor_2706lines", "../combatlog/parser/vanilla/state/encounters/character/testdata/scholotutor/WoWCombatLog.txt"},
	// Add larger fixtures from ignoredlogs/ manually:
	// {"rfc_75k", "../ignoredlogs/rfc_no_oggle/WoWCombatLog.txt"},
	// {"ubrs_55k", "../ignoredlogs/ubrs/WoWCombatLog.txt"},
	// {"mc_wipe_396k", "../ignoredlogs/mc_wipe_domo/WoWCombatLog.txt"},
	// {"raid_472k", "../ignoredlogs/raid/WoWCombatLog.txt"},
}

// BenchmarkSortLogs benchmarks the log sorting phase.
func BenchmarkSortLogs(b *testing.B) {
	ctx := context.Background()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	levelLogger := leveledlog.New(logger, slog.LevelWarn)

	for _, fixture := range benchFixtures {
		data, err := os.ReadFile(fixture.path)
		if err != nil {
			b.Logf("skipping %s: %v", fixture.name, err)
			continue
		}

		b.Run(fixture.name, func(b *testing.B) {
			b.ReportAllocs()
			b.SetBytes(int64(len(data)))
			b.ResetTimer()

			for i := 0; i < b.N; i++ {
				buf := &bytes.Buffer{}
				_, _, err := sorter.SortLogs(ctx, levelLogger, bytes.NewReader(data), buf)
				if err != nil {
					b.Fatal(err)
				}
			}
		})
	}
}

// BenchmarkParseCombatLog benchmarks the full parse pipeline:
// parser + consumers + finalize (no DB).
func BenchmarkParseCombatLog(b *testing.B) {
	ctx := context.Background()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	for _, fixture := range benchFixtures {
		data, err := os.ReadFile(fixture.path)
		if err != nil {
			b.Logf("skipping %s: %v", fixture.name, err)
			continue
		}

		// Pre-check if this fixture works with the full pipeline
		p, err := vanilla.New(logger, bytes.NewReader(data), nil)
		if err != nil {
			b.Logf("skipping %s: parser init error: %v", fixture.name, err)
			continue
		}
		testState := encounters.New(ctx, logger)
		testConsumers := consumers.New(logger, testState)
		if err := testConsumers.ConsumeAll(ctx, p); err != nil {
			b.Logf("skipping %s: parse error: %v", fixture.name, err)
			continue
		}

		b.Run(fixture.name, func(b *testing.B) {
			b.ReportAllocs()
			b.SetBytes(int64(len(data)))
			b.ResetTimer()

			for i := 0; i < b.N; i++ {
				p, err := vanilla.New(logger, bytes.NewReader(data), nil)
				if err != nil {
					b.Fatal(err)
				}

				encountersState := encounters.New(ctx, logger)
				c := consumers.New(logger, encountersState)

				err = c.ConsumeAll(ctx, p)
				if err != nil {
					b.Fatal(err)
				}

				// Include Finalize since it takes significant time
				for _, inst := range encountersState.Instances {
					_, err = inst.Finalize(ctx)
					if err != nil {
						b.Fatal(err)
					}
				}
			}
		})
	}
}

// BenchmarkParseOnly benchmarks just the parser without consumers or finalize.
func BenchmarkParseOnly(b *testing.B) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

fixtureLoop:
	for _, fixture := range benchFixtures {
		data, err := os.ReadFile(fixture.path)
		if err != nil {
			b.Logf("skipping %s: %v", fixture.name, err)
			continue
		}

		// Pre-check if this fixture can be parsed
		testParser, err := vanilla.New(logger, bytes.NewReader(data), nil)
		if err != nil {
			b.Logf("skipping %s: parser init error: %v", fixture.name, err)
			continue
		}
		for {
			_, err := testParser.Advance(context.Background())
			if err != nil {
				if err == io.EOF {
					break
				}
				if parseerrors.IsFatalError(err) {
					b.Logf("skipping %s: fatal parse error: %v", fixture.name, err)
					continue fixtureLoop
				}
			}
		}

		b.Run(fixture.name, func(b *testing.B) {
			b.ReportAllocs()
			b.SetBytes(int64(len(data)))
			b.ResetTimer()

			for i := 0; i < b.N; i++ {
				p, err := vanilla.New(logger, bytes.NewReader(data), nil)
				if err != nil {
					b.Fatal(err)
				}

				// Just parse, no consumers
				for {
					_, err := p.Advance(context.Background())
					if err != nil {
						if err == io.EOF {
							break
						}
						// Non-fatal errors are expected for some lines
						if parseerrors.IsFatalError(err) {
							b.Fatal(err)
						}
					}
				}
			}
		})
	}
}

// TestBenchFixturesExist verifies that benchmark fixtures are accessible.
func TestBenchFixturesExist(t *testing.T) {
	t.Parallel()

	found := 0
	for _, fixture := range benchFixtures {
		_, err := os.Stat(fixture.path)
		if err == nil {
			found++
			t.Logf("✓ %s exists", fixture.name)
		} else {
			t.Logf("✗ %s not found: %v", fixture.name, err)
		}
	}

	require.Greater(t, found, 0, "at least one benchmark fixture must exist")
}
