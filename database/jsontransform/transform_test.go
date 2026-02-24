package jsontransform

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/Emyrk/chronicle/database/gamedb/chrondbc"
	"github.com/Gophercraft/core/i18n"
	"github.com/stretchr/testify/require"
)

func TestTransformSpell(t *testing.T) {
	t.Parallel()

	spell := &chrondbc.Spell{
		ID:        133,
		Name_lang: i18n.GetEnglish("Fireball"),
	}

	result := Transform(spell)

	// Should be simplified to SpellRef
	ref, ok := result.(SpellRef)
	require.True(t, ok, "expected SpellRef, got %T", result)
	require.Equal(t, int32(133), ref.ID)
	require.Equal(t, "Fireball", ref.Name)
}

func TestTransformSpellNil(t *testing.T) {
	t.Parallel()

	var spell *chrondbc.Spell
	result := Transform(spell)
	require.Nil(t, result)
}

func TestTransformNestedStruct(t *testing.T) {
	t.Parallel()

	type Inner struct {
		Spell *chrondbc.Spell `json:"spell"`
		Value int             `json:"value"`
	}
	type Outer struct {
		Inner Inner  `json:"inner"`
		Name  string `json:"name"`
	}

	spell := &chrondbc.Spell{ID: 456, Name_lang: i18n.GetEnglish("Frostbolt")}

	outer := Outer{
		Inner: Inner{
			Spell: spell,
			Value: 100,
		},
		Name: "test",
	}

	result := Transform(outer)

	// Marshal and check the JSON output
	data, err := json.Marshal(result)
	require.NoError(t, err)

	// The spell should be simplified
	expected := `{"inner":{"spell":{"id":456,"name":"Frostbolt"},"value":100},"name":"test"}`
	require.JSONEq(t, expected, string(data))
}

func TestTransformSliceWithSpells(t *testing.T) {
	t.Parallel()

	spell1 := &chrondbc.Spell{ID: 1, Name_lang: i18n.GetEnglish("Spell1")}
	spell2 := &chrondbc.Spell{ID: 2, Name_lang: i18n.GetEnglish("Spell2")}

	spells := []*chrondbc.Spell{spell1, spell2}

	result := Transform(spells)
	data, err := json.Marshal(result)
	require.NoError(t, err)

	expected := `[{"id":1,"name":"Spell1"},{"id":2,"name":"Spell2"}]`
	require.JSONEq(t, expected, string(data))
}

func TestTransformOmitempty(t *testing.T) {
	t.Parallel()

	type Data struct {
		Name  string `json:"name,omitempty"`
		Value int    `json:"value,omitempty"`
	}

	// Empty values should be omitted
	result := Transform(Data{})
	data, err := json.Marshal(result)
	require.NoError(t, err)
	require.JSONEq(t, `{}`, string(data))

	// Non-empty values should be included
	result = Transform(Data{Name: "test", Value: 42})
	data, err = json.Marshal(result)
	require.NoError(t, err)
	require.JSONEq(t, `{"name":"test","value":42}`, string(data))
}

func TestTransformPreservesBasicTypes(t *testing.T) {
	t.Parallel()

	type Data struct {
		String  string        `json:"string"`
		Int     int           `json:"int"`
		Float   float64       `json:"float"`
		Bool    bool          `json:"bool"`
		Time    time.Time     `json:"time"`
		Dur     time.Duration `json:"dur"`
		Pointer *string       `json:"pointer,omitempty"`
	}

	str := "ptr"
	ts := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	data := Data{
		String:  "hello",
		Int:     42,
		Float:   3.14,
		Bool:    true,
		Time:    ts,
		Dur:     5 * time.Second,
		Pointer: &str,
	}

	result := Transform(data)
	jsonData, err := json.Marshal(result)
	require.NoError(t, err)

	// Parse back and verify
	var parsed map[string]any
	err = json.Unmarshal(jsonData, &parsed)
	require.NoError(t, err)

	require.Equal(t, "hello", parsed["string"])
	require.Equal(t, float64(42), parsed["int"])
	require.Equal(t, 3.14, parsed["float"])
	require.Equal(t, true, parsed["bool"])
	require.Equal(t, "ptr", parsed["pointer"])
}

func TestMarshalForStorage(t *testing.T) {
	t.Parallel()

	spell := &chrondbc.Spell{ID: 789, Name_lang: i18n.GetEnglish("Lightning Bolt")}

	type Message struct {
		SpellData *chrondbc.Spell `json:"spell_data"`
		Amount    int32           `json:"amount"`
	}

	msg := Message{
		SpellData: spell,
		Amount:    500,
	}

	data, err := MarshalForStorage(msg)
	require.NoError(t, err)

	expected := `{"spell_data":{"id":789,"name":"Lightning Bolt"},"amount":500}`
	require.JSONEq(t, expected, string(data))
}
