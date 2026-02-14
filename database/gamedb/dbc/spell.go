package dbc

import (
	"github.com/Gophercraft/core/format/dbc/dbdefs"
)

type Spell struct {
	dbdefs.Ent_Spell
}

func (s Spell) String() string {
	return s.Name_lang.String()
}

// Attributes returns all attribute blocks for this spell.
func (s Spell) Attributes() SpellAttributes {
	return SpellAttributesFromSpell(&s.Ent_Spell)
}
