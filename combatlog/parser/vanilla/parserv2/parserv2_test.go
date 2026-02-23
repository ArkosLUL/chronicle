package parserv2

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/Emyrk/chronicle/combatlog/parser/types"
	"github.com/Emyrk/chronicle/combatlog/parser/types/castv2"
	"github.com/Emyrk/chronicle/combatlog/parser/types/unitinfo"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
	"github.com/Emyrk/chronicle/database/gamedb"
	"github.com/Emyrk/chronicle/database/gamedb/chrondbc"
	"github.com/Emyrk/chronicle/internal/ptr"
	"github.com/rs/zerolog"
	slogzerolog "github.com/samber/slog-zerolog/v2"
	"github.com/stretchr/testify/require"
)

// mockSpellFetcher implements gamedb.SpellFetcher for testing.
// Populate Spells map with spell data needed for tests.
type mockSpellFetcher struct {
	Spells map[chrondbc.SpellID]*chrondbc.Spell
}

func (m *mockSpellFetcher) Spell(id chrondbc.SpellID) (*chrondbc.Spell, error) {
	if m.Spells == nil {
		return nil, fmt.Errorf("spell %d not found", id)
	}
	sp, ok := m.Spells[id]
	if !ok {
		return nil, fmt.Errorf("spell %d not found", id)
	}
	return sp, nil
}

// testCase parses line and asserts result matches expected message
func testCase[T messages.Message](t *testing.T, line string, expected T) {
	t.Helper()
	testCaseWithDB[T](t, line, expected, &mockSpellFetcher{})
}

// testCaseWithDB parses line with a SpellFetcher and asserts result matches expected
func testCaseWithDB[T messages.Message](t *testing.T, line string, expected T, wowDB gamedb.SpellFetcher) {
	t.Helper()
	ctx := context.Background()

	zerologLogger := zerolog.New(zerolog.ConsoleWriter{Out: os.Stderr})
	logger := slog.New(slogzerolog.Option{Level: slog.LevelDebug, Logger: &zerologLogger}.NewZerologHandler())

	p, err := New(logger, strings.NewReader(line), wowDB)
	require.NoError(t, err)
	msgs, err := p.Advance(ctx)
	require.NoError(t, err)
	require.Len(t, msgs, 1, "expected single message, got %d", len(msgs))

	got, ok := msgs[0].(T)
	require.True(t, ok, "expected %T, got %T", expected, msgs[0])
	require.EqualValues(t, expected, got)
}

func TestParserMessages(t *testing.T) {
	t.Parallel()

	t.Run("Header", func(t *testing.T) {
		t.Parallel()

		testCase(t,
			"1771870624417|HEADER|0x0000000000432A74|Nordanaar|Ragefire Chasm|0.5|1.5||1771083771|1.18.0|7234|Dec 19 2025|23.02.26 19:17:05|23.02.26 18:17:05|200",
			&messages.Realm{},
		)
	})

	t.Run("SwingMiss", func(t *testing.T) {
		t.Parallel()

		testCase(t,
			"1771564197000|SWING|0x000000000001C7AC|0xF130002C3800949C|194|2|1|1|0|0|0   ",
			&messages.Damage{
				MessageBase: messages.Base(time.UnixMilli(1771564197000)),
				SpellName:   ptr.Ref("Auto Attack"),
				Caster:      ptr.Ref(guid.GUID(0x000000000001C7AC)),
				Target:      guid.GUID(0xF130002C3800949C),
				Amount:      194, // subDamage adds to amount
				HitType:     types.HitTypeHit,
				School:      types.PhysicalSchool,
				Trailer:     nil,
			},
		)
	})

	t.Run("SwingCrit", func(t *testing.T) {
		t.Parallel()
		// SwingHitInfo=130 (HITINFO_AFFECTS_VICTIM | HITINFO_CRITICALHIT) + VictimState=1 = Crit
		testCase(t,
			"1771542038|SWING|0xF130002C3600BE05|0x000000000001C80A|100|130|1|0|0|0|0",
			&messages.Damage{
				MessageBase: messages.Base(time.UnixMilli(1771542038)),
				SpellName:   ptr.Ref("Auto Attack"),
				Caster:      ptr.Ref(guid.GUID(0xF130002C3600BE05)),
				Target:      guid.GUID(0x000000000001C80A),
				Amount:      100,
				HitType:     types.HitTypeCrit,
				School:      types.PhysicalSchool,
				Trailer:     nil,
			},
		)
	})

	t.Run("UnitInfo", func(t *testing.T) {
		t.Parallel()

		// Format: timestamp|UNIT_INFO|guid|isPlayer|name|canCooperate|owner|buffs|level|challenges|maxHealth
		testCase(t,
			"1771563953000|UNIT_INFO|0x000000000001C80A|1|Priests|1|||60||3117",
			&messages.Unit{
				MessageBase: messages.Base(time.UnixMilli(1771563953000)),
				Info: unitinfo.Info{
					Seen:         time.UnixMilli(1771563953000),
					Guid:         guid.GUID(0x000000000001C80A),
					IsPlayer:     true,
					Name:         "Priests",
					CanCooperate: true,
					Owner:        nil,
					Buffs:        []unitinfo.Buff{},
					Level:        60,
					Challenges:   []string{},
				},
			},
		)
	})

	t.Run("Spell Go", func(t *testing.T) {
		t.Parallel()
		t.Skip("Spell db mock")
		testCase(t,
			"1771770885937|SPELL_GO|0|15237|0x000000000001C80A|0x0000000000000000|256|0|1",
			&messages.Cast{
				MessageBase: messages.Base(time.UnixMilli(1771563953000)),
				CastV2: castv2.CastV2{
					Caster: types.Unit{},
					Action: "",
					Target: nil,
					Spell:  types.Spell{},
				},
			})
	})
	// Add more test cases:
	// t.Run("Heal", func(t *testing.T) {
	// 	t.Parallel()
	// 	testCaseWithDB(t,
	// 		"1771542037|HEAL|0x000000000001C80A|0x000000000001C80A|27805|507|0|0",
	// 		&messages.Heal{...},
	// 		wowDB,
	// 	)
	// })
}
