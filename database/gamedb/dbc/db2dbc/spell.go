// Package db2dbc converts database models to dbc types.
package db2dbc

import (
	"github.com/Emyrk/chronicle/database"
	"github.com/Emyrk/chronicle/database/gamedb/dbc"
	"github.com/Gophercraft/core/i18n"
)

// Spell converts a database SpellTemplate to a dbc.Spell.
func Spell(st database.SpellTemplate) *dbc.Spell {
	var attrs dbc.SpellAttributes
	for i := 0; i < len(st.Attributes) && i < len(attrs); i++ {
		attrs[i] = uint32(st.Attributes[i])
	}

	return &dbc.Spell{
		ID:                   st.ID,
		Name_lang:            i18n.Text{i18n.English: st.Name},
		NameSubtext_lang:     i18n.Text{i18n.English: st.Subtext.String},
		Description_lang:     i18n.Text{i18n.English: st.Description.String},
		AuraDescription_lang: i18n.Text{i18n.English: st.AuraDescription.String},
		SpellIconID:          st.IconID.Int32,
		SchoolMask:           st.SchoolMask.Int32,
		PowerType:            st.PowerType.Int32,
		ManaCost:             st.ManaCost.Int32,
		ManaCostPct:          st.ManaCostPct.Int32,
		CastingTimeIndex:     st.CastTimeIndex.Int32,
		RecoveryTime:         st.RecoveryTime.Int32,
		RangeIndex:           st.RangeIndex.Int32,
		Attrs:                attrs,
		Targets:              dbc.TargetFlags(st.Targets.Int32),
	}
}

// Spells converts a slice of database SpellTemplates to dbc.Spells.
func Spells(sts []database.SpellTemplate) []*dbc.Spell {
	spells := make([]*dbc.Spell, len(sts))
	for i, st := range sts {
		spells[i] = Spell(st)
	}
	return spells
}
