package main

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/Emyrk/chronicle/scripts/dbcdata/cli"

	"github.com/coder/serpent"

	"github.com/Emyrk/chronicle/scripts/dbcdata/dbcdb"
	"github.com/Gophercraft/core/format/dbc/dbdefs"
)

func main() {
	err := rootCmd().Invoke().WithOS().Run()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func rootCmd() *serpent.Command {
	cmd := &serpent.Command{
		Use:     "dbcdata",
		Short:   "Generate Go code from DBC files.",
		Handler: serpent.DefaultHelpFn(),
	}
	cmd.AddSubcommands(
		cli.StaticPopulateCmd(),
		demo(),
		cli.Populate(),
	)
	return cmd
}

func demo() *serpent.Command {
	var dbcPath string
	return &serpent.Command{
		Use:   "demo",
		Short: "Demo.",
		Options: serpent.OptionSet{
			{
				Name:        "dbc",
				Description: "Path to WoW client directory.",
				Flag:        "dbc",
				Value:       serpent.StringOf(&dbcPath),
				Default:     "/home/steven/Games/turtlewow/drive_c/Program Files (x86)/TurtleWoW",
			},
		},
		Handler: func(inv *serpent.Invocation) error {
			wc, err := dbcdb.New(dbcPath)
			if err != nil {
				return fmt.Errorf("open wow client: %w", err)
			}

			spdb, err := wc.Spells()
			if err != nil {
				return fmt.Errorf("read spells: %w", err)
			}

			highest := int32(0)
			err = spdb.Range(func(cursor *dbdefs.Ent_Spell) bool {
				//if cursor.Name_lang.String() == "Renew" {
				//	d, _ := json.Marshal(cursor)
				//	fmt.Println(string(d))
				//}
				if cursor.PowerDisplayID > 0 {
					//for _, m := range cursor.EffectSpellClassMaskB {
					//if m != 0 {
					fmt.Println(cursor.PowerDisplayID)
					d, _ := json.Marshal(cursor)
					fmt.Println(string(d))
					//}
					//}
				}
				//if len(cursor.AuraInterruptFlags) > 1 {
				//	for i, e := range cursor.AuraInterruptFlags {
				//		if i > 0 && e > highest {
				//			highest = e
				//		}
				//		if e != 0 {
				//			fmt.Println(cursor.AuraInterruptFlags)
				//			fmt.Println(cursor.Name_lang.String(), cursor.ID, e)
				//			break
				//		}
				//	}
				//}
				//if len(cursor.Reagent) != 0 {
				//	for _, r := range cursor.Reagent {
				//		if r != 0 {
				//			fmt.Println(cursor.Name_lang.String(), cursor.ID, cursor.Reagent)
				//			d, _ := json.Marshal(cursor)
				//			fmt.Println(string(d))
				//			break
				//		}
				//	}
				//}
				//if cursor.ProcFlags > 0 {
				//	fmt.Println(cursor.ProcFlags)
				//	d, _ := json.Marshal(cursor)
				//	fmt.Println(string(d))
				//}
				return true
			})
			fmt.Println(highest)
			if err != nil {
				return fmt.Errorf("iterate spells: %w", err)
			}

			r, err := wc.SpellCategory()
			if err != nil {
				return fmt.Errorf("read spells: %w", err)
			}

			err = r.Range(func(cursor *dbdefs.Ent_SpellCategory) bool {
				//d, _ := json.Marshal(cursor)
				//fmt.Println(string(d))
				return true
			})
			if err != nil {
				return fmt.Errorf("iterate spells: %w", err)
			}
			fmt.Println(r.Len())

			return nil
		},
	}
}
