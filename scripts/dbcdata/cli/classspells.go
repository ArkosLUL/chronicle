package cli

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"

	"github.com/Emyrk/chronicle/database/gamedb/chrondbc"
	"github.com/Emyrk/chronicle/database/gamedb/dbcdb"
)

type classSpellEntry struct {
	ID              int32  `json:"id"`
	Name            string `json:"name"`
	SpellDamageType int32  `json:"spellDamageType"`
}

func collectSpellsByClass(wc *dbcdb.WoWClient) (map[string][]classSpellEntry, error) {
	spellsDBC, err := wc.Spells()
	if err != nil {
		return nil, fmt.Errorf("read spells: %w", err)
	}

	spells := chrondbc.NewSpells(spellsDBC.Underlying())
	byClass := make(map[chrondbc.SpellClassSet][]classSpellEntry)

	err = spells.Range(func(spell *chrondbc.Spell) bool {
		cs := spell.SpellClassSet
		if cs == chrondbc.SpellClassSetGeneric {
			return true
		}
		byClass[cs] = append(byClass[cs], classSpellEntry{
			ID:              int32(spell.ID),
			Name:            spell.String(),
			SpellDamageType: int32(spell.SpellDamageType()),
		})
		return true
	})
	if err != nil {
		return nil, fmt.Errorf("iterate spells: %w", err)
	}

	result := make(map[string][]classSpellEntry, len(byClass))
	for cs, entries := range byClass {
		sort.Slice(entries, func(i, j int) bool {
			return entries[i].ID < entries[j].ID
		})
		result[cs.String()] = entries
	}

	return result, nil
}

func writeJSON(path string, data any) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}

	out, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, out, 0o644)
}
