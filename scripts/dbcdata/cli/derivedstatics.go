package cli

import (
	"fmt"
	"path/filepath"

	"github.com/Emyrk/chronicle/database/gamedb/dbcdb"
	"github.com/coder/serpent"
)

func DerivedStaticsCmd() *serpent.Command {
	var goDir string
	var tsDir string
	var dbcPath string

	return &serpent.Command{
		Use:   "derived-statics",
		Short: "Generate spell-derived static files for Go and TypeScript.",
		Options: serpent.OptionSet{
			{
				Name:        "go-dir",
				Description: "Output directory for generated Go files.",
				Flag:        "go-dir",
				Value:       serpent.StringOf(&goDir),
			},
			{
				Name:        "ts-dir",
				Description: "Output directory for generated TypeScript files.",
				Flag:        "ts-dir",
				Value:       serpent.StringOf(&tsDir),
			},
			{
				Name:        "dbc",
				Description: "Path to WoW client directory.",
				Flag:        "dbc",
				Value:       serpent.StringOf(&dbcPath),
				Default:     "/home/steven/Games/turtlewow/drive_c/Program Files (x86)/TurtleWoW",
			},
		},
		Handler: func(inv *serpent.Invocation) error {
			if goDir == "" {
				return fmt.Errorf("--go-dir is required")
			}
			if tsDir == "" {
				return fmt.Errorf("--ts-dir is required")
			}

			wc, err := dbcdb.New(dbcPath)
			if err != nil {
				return fmt.Errorf("open wow client: %w", err)
			}

			if err := generateDerivedPeriodicSpells(wc, goDir); err != nil {
				return fmt.Errorf("generate periodic spells: %w", err)
			}
			if err := generateDerivedVulnerabilitySpells(wc, goDir, tsDir); err != nil {
				return fmt.Errorf("generate vulnerability spells: %w", err)
			}
			if err := generateDerivedExtraAttacks(wc, goDir, tsDir); err != nil {
				return fmt.Errorf("generate extra attack spells: %w", err)
			}

			return nil
		},
	}
}

func generateDerivedPeriodicSpells(wc *dbcdb.WoWClient, goDir string) error {
	entries, err := collectPeriodicSpells(wc)
	if err != nil {
		return err
	}

	return writeTemplate(filepath.Join(goDir, "periodicspells.go"), periodicSpellsGoTemplate, entries)
}

func generateDerivedVulnerabilitySpells(wc *dbcdb.WoWClient, goDir, tsDir string) error {
	entries, err := collectVulnerabilitySpells(wc)
	if err != nil {
		return err
	}

	if err := writeTemplate(filepath.Join(goDir, "vulnerabilityspells.go"), vulnerabilitySpellsGoTemplate, entries); err != nil {
		return err
	}

	return writeTemplate(filepath.Join(tsDir, "VulnerabilitySpells.ts"), vulnerabilitySpellsTSTemplate, entries)
}

func generateDerivedExtraAttacks(wc *dbcdb.WoWClient, goDir, tsDir string) error {
	entries, err := collectExtraAttackSpells(wc)
	if err != nil {
		return err
	}

	if err := writeTemplate(filepath.Join(goDir, "extraattack.go"), extraAttacksGoTemplate, entries); err != nil {
		return err
	}

	return writeTemplate(filepath.Join(tsDir, "ExtraAttack.ts"), extraAttacksTSTemplate, entries)
}
