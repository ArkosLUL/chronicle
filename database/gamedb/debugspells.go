package gamedb

import (
	"context"

	"github.com/Emyrk/chronicle/database/gamedb/chrondbc"
)

func spellNameDifferences(ctx context.Context, db *chrondbc.SpellsDBC, names map[string][]int32) {
	lookup := make(map[chrondbc.SpellID]*chrondbc.Spell)
	db.Range(func(cursor *chrondbc.Spell) bool {
		lookup[cursor.ID] = cursor
		return true
	})

	for k, v := range names {
		if ctx.Err() != nil {
			return
		}
		if len(v) <= 1 {
			continue
		}

		list := make([]*chrondbc.Spell, 0, len(v))
		for _, id := range v {
			sp, ok := lookup[chrondbc.SpellID(id)]
			if !ok {
				panic("spell not found in lookup: " + k)
			}
			list = append(list, sp)
		}

		// Check all defense types
		var defenceType = list[0].DefenseType
		for _, sp := range list {
			if sp.DefenseType != defenceType {
				println("Spell name with multiple IDs:", k)
				for _, sp := range list {
					println("  ID:", sp.ID, "DefenseType:", sp.DefenseType)
				}
				break
			}
		}
	}
}
