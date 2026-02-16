package main

import (
	"fmt"

	"github.com/Emyrk/chronicle/database/gamedb/dbc"
	"github.com/Emyrk/chronicle/scripts/dbcdata/dbcdb"
	"github.com/Gophercraft/core/format/dbc/dbdefs"
)

func main() {
	wc, err := dbcdb.New()
	if err != nil {
		panic(err)
	}

	spdb, err := wc.Spells()
	if err != nil {
		panic(err)
	}

	err = spdb.Range(func(cursor *dbdefs.Ent_Spell) bool {
		if cursor == nil {
			return true
		}
		sp := dbc.NewSpell(*cursor)
		if sp.Targets.Has(dbc.TargetCorpseAlly) {
			fmt.Println(sp.Name_lang.String())
		}
		return true
	})
	if err != nil {
		panic(err)
	}

	sp, err := spdb.Index(14769)
	if err != nil {
		panic(err)
	}
	fmt.Println(sp)
}
