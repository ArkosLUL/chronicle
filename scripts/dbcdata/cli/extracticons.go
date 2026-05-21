package cli

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/Gophercraft/core/format/dbc/dbdefs"

	"github.com/Emyrk/chronicle/database/gamedb/dbcdb"

	"github.com/coder/serpent"
)

func ExtractIconsCmd() *serpent.Command {
	var dbcPath string
	var server string
	var outDir string

	return &serpent.Command{
		Use:   "extract-icons",
		Short: "Extract all icon BLP files from a WoW client directory.",
		Options: serpent.OptionSet{
			DBCOption(&dbcPath),
			ServerOption(&server),
			{
				Name:        "out",
				Description: "Output directory for extracted BLP files.",
				Flag:        "out",
				Value:       serpent.StringOf(&outDir),
			},
		},
		Handler: func(inv *serpent.Invocation) error {
			if outDir == "" {
				return fmt.Errorf("--out is required")
			}

			resolved, err := ResolveDBCPath(dbcPath, server)
			if err != nil {
				return err
			}
			wc, err := dbcdb.New(resolved)
			if err != nil {
				return fmt.Errorf("(extract icons) open wow client: %w", err)
			}
			//nolint:errcheck
			defer wc.Close()

			return extractIcons(wc, resolved, outDir, inv.Stdout)
		},
	}
}

func extractIcons(wc *dbcdb.WoWClient, clientPath, outDir string, stdout io.Writer) error {
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		return fmt.Errorf("create output directory: %w", err)
	}

	// Build an MPQ fallback reader for files not found via the Pool's listfile
	// index. Some WoW clients (AzerothCore, Epoch, Ascension) have MPQs
	// without listfiles, so Pool.OpenFile fails. Direct MPQ hash-based lookup
	// works when we know the path.
	fallback, err := newMPQFallback(clientPath)
	if err != nil {
		_, _ = fmt.Fprintf(stdout, "  Warning: MPQ fallback unavailable: %v\n", err)
	} else {
		defer fallback.Close()
	}

	readFile := func(path string) ([]byte, error) {
		data, err := wc.ReadFile(path)
		if err == nil {
			return data, nil
		}
		if fallback != nil {
			return fallback.ReadFile(path)
		}
		return nil, err
	}

	// Phase 1: ListFiles() discovers icons from MPQ archives that have
	// embedded listfiles. This catches ALL icon types (spells, items,
	// achievements, buffs, UI, etc.) but misses icons in listfile-less MPQs.
	const prefix = `Interface\Icons\`
	written := make(map[string]bool) // lowercase name → true
	var extracted, skipped int

	files, err := wc.ListFiles()
	if err != nil {
		_, _ = fmt.Fprintf(stdout, "  Warning: ListFiles failed: %v\n", err)
	}
	for _, f := range files {
		if !strings.HasPrefix(f, prefix) {
			continue
		}
		if !strings.HasSuffix(strings.ToLower(f), ".blp") {
			continue
		}

		data, err := readFile(f)
		if err != nil {
			_, _ = fmt.Fprintf(stdout, "  SKIP %s: %v\n", f, err)
			skipped++
			continue
		}

		name := strings.ToLower(strings.TrimPrefix(f, prefix))
		if err := os.WriteFile(filepath.Join(outDir, name), data, 0o644); err != nil {
			return fmt.Errorf("write %s: %w", name, err)
		}
		written[name] = true
		extracted++
	}

	_, _ = fmt.Fprintf(stdout, "Phase 1 (ListFiles): extracted %d, skipped %d\n", extracted, skipped)

	// Phase 2: Use SpellIcon.dbc to find icons that were missed by
	// ListFiles(). This covers spell/talent/ability icons in MPQs without
	// listfiles. Not exhaustive for all icon types, but catches the most
	// commonly referenced ones.
	icons, err := wc.SpellIcons()
	if err != nil {
		_, _ = fmt.Fprintf(stdout, "  Warning: SpellIcon.dbc unavailable: %v\n", err)
		_, _ = fmt.Fprintf(stdout, "Extracted %d icons (%d skipped) to %s\n", extracted, skipped, outDir)
		return nil
	}

	var dbcExtracted, dbcSkipped int
	err = icons.Range(func(cursor *dbdefs.Ent_SpellIcon) bool {
		if cursor.TextureFilename == "" {
			return true
		}

		// TextureFilename may be a bare name ("Ability_Warrior_Warbringer")
		// or include the prefix ("Interface\Icons\Ability_Warrior_Warbringer").
		// Some entries reference paths outside Interface\Icons\ (e.g.
		// "Interface\Spellbook\...") — skip those.
		texName := cutIconPrefix(cursor.TextureFilename)
		if texName != cursor.TextureFilename {
			// Had the Interface\Icons\ prefix — stripped successfully.
		} else if strings.ContainsRune(texName, '\\') {
			// Path outside Interface\Icons\ — not an icon we extract.
			return true
		}

		outName := strings.ToLower(texName) + ".blp"
		if written[outName] {
			return true // Already extracted in phase 1.
		}

		blpPath := prefix + texName + ".blp"
		data, err := readFile(blpPath)
		if err != nil {
			_, _ = fmt.Fprintf(stdout, "  SKIP %s: %v\n", blpPath, err)
			dbcSkipped++
			return true
		}

		if err := os.WriteFile(filepath.Join(outDir, outName), data, 0o644); err != nil {
			_, _ = fmt.Fprintf(stdout, "  ERROR %s: %v\n", outName, err)
			return false
		}
		written[outName] = true
		dbcExtracted++
		return true
	})
	if err != nil {
		return fmt.Errorf("iterate SpellIcon.dbc: %w", err)
	}

	_, _ = fmt.Fprintf(stdout, "Phase 2 (SpellIcon.dbc): extracted %d new, skipped %d (%d in DBC)\n",
		dbcExtracted, dbcSkipped, icons.Len())
	_, _ = fmt.Fprintf(stdout, "Total: %d icons extracted to %s\n", extracted+dbcExtracted, outDir)
	return nil
}
