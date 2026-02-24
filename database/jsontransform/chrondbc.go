package jsontransform

import "github.com/Emyrk/chronicle/database/gamedb/chrondbc"

// SpellRef is the simplified JSON representation of a Spell for storage.
type SpellRef struct {
	ID   int32  `json:"id"`
	Name string `json:"name"`
}

func init() {
	// Register transformer for chrondbc.Spell to store only {id, name}
	RegisterTransformer(func(v any) (any, bool) {
		switch spell := v.(type) {
		case *chrondbc.Spell:
			if spell == nil {
				return nil, true
			}
			return SpellRef{ID: int32(spell.ID), Name: spell.Name()}, true
		case chrondbc.Spell:
			return SpellRef{ID: int32(spell.ID), Name: spell.Name()}, true
		}
		return nil, false
	})
}
