package cli

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/Emyrk/chronicle/database/gamedb/dbcdb"
	dbcdatacli "github.com/Emyrk/chronicle/scripts/dbcdata/cli"
	"github.com/coder/serpent"
)

func DBCCmd() *serpent.Command {
	return &serpent.Command{
		Use:   "dbc",
		Short: "DBC file utilities.",
		Children: []*serpent.Command{
			dbcExtractCmd(),
		},
	}
}

func dbcExtractCmd() *serpent.Command {
	var dbcPath, server, outDir string

	return &serpent.Command{
		Use:   "extract <name.dbc> [name2.dbc ...]",
		Short: "Extract DBC files from a WoW client directory.",
		Long:  "Reads DBC files from the client's MPQ archives and writes them to the output directory.\nExample: chronicle dbc extract ItemDisplayInfo.dbc Spell.dbc",
		Options: serpent.OptionSet{
			dbcdatacli.DBCOption(&dbcPath),
			dbcdatacli.ServerOption(&server),
			{
				Name:        "out",
				Description: "Output directory for extracted files.",
				Flag:        "out",
				Default:     ".",
				Value:       serpent.StringOf(&outDir),
			},
		},
		Handler: func(inv *serpent.Invocation) error {
			if len(inv.Args) == 0 {
				return fmt.Errorf("at least one DBC file name is required (e.g. ItemDisplayInfo.dbc)")
			}

			resolved, err := dbcdatacli.ResolveDBCPath(dbcPath, server)
			if err != nil {
				return err
			}

			wc, err := dbcdb.New(resolved)
			if err != nil {
				return fmt.Errorf("open wow client at %s: %w", resolved, err)
			}
			//nolint:errcheck
			defer wc.Close()

			if err := os.MkdirAll(outDir, 0o755); err != nil {
				return fmt.Errorf("create output directory: %w", err)
			}

			for _, name := range inv.Args {
				// Normalize: ensure the MPQ path has the right format.
				// Accept "ItemDisplayInfo.dbc" or "ItemDisplayInfo".
				baseName := strings.TrimSuffix(name, ".dbc")
				mpqPath := `DBFilesClient\` + baseName + ".dbc"

				data, err := wc.ReadFile(mpqPath)
				if err != nil {
					_, _ = fmt.Fprintf(inv.Stderr, "SKIP %s: %v\n", name, err)
					continue
				}

				outFile := filepath.Join(outDir, baseName+".dbc")
				if err := os.WriteFile(outFile, data, 0o644); err != nil {
					return fmt.Errorf("write %s: %w", outFile, err)
				}
				_, _ = fmt.Fprintf(inv.Stderr, "extracted %s (%d bytes)\n", outFile, len(data))
			}

			return nil
		},
	}
}
