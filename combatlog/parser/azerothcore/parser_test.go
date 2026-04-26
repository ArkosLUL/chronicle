package azerothcore

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/Emyrk/chronicle/combatlog/parser/types"
	"github.com/Emyrk/chronicle/combatlog/parser/types/combatant"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters/registry"
	"github.com/Emyrk/chronicle/database"
	"github.com/Emyrk/chronicle/database/gamedb"
	"github.com/Emyrk/chronicle/database/gamedb/chrondbc"
)

var _ gamedb.GameDB = (*stubSpellDB)(nil)

type stubSpellDB struct{}

func (stubSpellDB) ResolveGear([]combatant.GearItem)                              {}
func (stubSpellDB) Creature(int32) (*database.WorldCreatureTemplate, bool)         { return nil, false }
func (stubSpellDB) Spell(chrondbc.SpellID) (*chrondbc.Spell, error) {
	return nil, fmt.Errorf("no spell database loaded")
}

func newTestParser(t *testing.T, logData string) *Parser {
	t.Helper()
	p, err := New(context.Background(), slog.Default(), strings.NewReader(logData), stubSpellDB{}, nil, registry.NewRegistry(slog.Default()))
	require.NoError(t, err)
	return p
}

// advanceOne calls Advance and returns the first non-Unit/non-Combatant message.
func advanceOne(t *testing.T, p *Parser) messages.Message {
	t.Helper()
	msgs, err := p.Advance(context.Background())
	require.NoError(t, err)
	require.NotEmpty(t, msgs)
	for _, m := range msgs {
		switch m.(type) {
		case *messages.Unit, *messages.Combatant:
			continue
		}
		return m
	}
	return msgs[0]
}

func TestParseSpellAbsorbed_Melee(t *testing.T) {
	t.Parallel()
	// Melee variant: no damage spell prefix (PW:S absorbs a melee hit).
	line := `1777166257180  SPELL_ABSORBED,0xF130002C36000022,"Ragefire Trogg",0x0,0x0000000000000001,"Chronicle",0x0,0x0000000000000001,"Chronicle",0x400,10901,"Power Word: Shield",0x2,11`

	p := newTestParser(t, line)
	msg := advanceOne(t, p)

	sa, ok := msg.(*messages.Absorbed)
	require.True(t, ok, "expected *messages.Absorbed, got %T", msg)

	assert.Equal(t, guid.GUID(0xF130002C36000022), sa.Attacker)
	assert.Equal(t, guid.GUID(0x0000000000000001), sa.Victim)
	assert.Nil(t, sa.DamageSpell, "melee absorbed should have nil DamageSpell")
	assert.Equal(t, guid.GUID(0x0000000000000001), sa.AbsorbCaster)
	// Spell lookup returns nil from stub, but ID was parsed correctly.
	assert.Nil(t, sa.AbsorbSpell)
	assert.Equal(t, types.School(0x2), sa.AbsorbSchool) // Holy
	assert.Equal(t, int32(11), sa.Amount)
}

func TestParseSpellAbsorbed_Spell(t *testing.T) {
	t.Parallel()
	// Spell variant: includes damage spell prefix (PW:S absorbs a Fireball).
	line := `1777166257180  SPELL_ABSORBED,0xF130002C36000022,"Ragefire Trogg",0x0,0x0000000000000001,"Chronicle",0x0,12345,"Fireball",0x4,0x0000000000000001,"Chronicle",0x400,10901,"Power Word: Shield",0x2,50`

	p := newTestParser(t, line)
	msg := advanceOne(t, p)

	sa, ok := msg.(*messages.Absorbed)
	require.True(t, ok, "expected *messages.Absorbed, got %T", msg)

	assert.Equal(t, guid.GUID(0xF130002C36000022), sa.Attacker)
	assert.Equal(t, guid.GUID(0x0000000000000001), sa.Victim)
	// Spell lookup returns nil from stub, but the spell variant was detected.
	assert.Nil(t, sa.DamageSpell)
	assert.Equal(t, guid.GUID(0x0000000000000001), sa.AbsorbCaster)
	assert.Nil(t, sa.AbsorbSpell)
	assert.Equal(t, types.School(0x2), sa.AbsorbSchool) // Holy
	assert.Equal(t, int32(50), sa.Amount)
}
