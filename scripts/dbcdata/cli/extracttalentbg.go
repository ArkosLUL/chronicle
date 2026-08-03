package cli

import (
	"fmt"
	"image"
	"image/draw"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/Gophercraft/core/format/dbc/dbdefs"
	"github.com/HugoSmits86/nativewebp"

	"github.com/Emyrk/chronicle/database/gamedb/dbcdb"

	"github.com/coder/serpent"
)

func ExtractTalentBackgroundsCmd() *serpent.Command {
	var dbcPath string
	var server string
	var outDir string

	return &serpent.Command{
		Use:   "extract-talent-backgrounds",
		Short: "Extract talent tree background BLP files from a WoW client and convert to WebP.",
		Options: serpent.OptionSet{
			DBCOption(&dbcPath),
			ServerOption(&server),
			{
				Name:        "out",
				Description: "Output directory for converted WebP files.",
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
				return fmt.Errorf("(extract talent backgrounds) open wow client: %w", err)
			}
			//nolint:errcheck
			defer wc.Close()

			return extractTalentBackgrounds(wc, outDir, inv.Stdout)
		},
	}
}

func extractTalentBackgrounds(wc *dbcdb.WoWClient, outDir string, stdout io.Writer) error {
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		return fmt.Errorf("create output directory: %w", err)
	}

	tabs, err := wc.TalentTab()
	if err != nil {
		return fmt.Errorf("read TalentTab.dbc: %w", err)
	}

	// Use only the Pool-based reader (no MPQ hash fallback). Talent
	// background textures live in standard MPQs with listfiles; the
	// hash-based fallback can hang on corrupted/listfile-less archives.
	readFile := func(path string) ([]byte, error) {
		return wc.ReadFile(path)
	}

	// Deduplicate: multiple classes can share the same tab background name.
	seen := make(map[string]bool)

	var extracted, skipped int
	err = tabs.Range(func(cursor *dbdefs.Ent_TalentTab) bool {
		if cursor.BackgroundFile == "" {
			return true
		}

		baseName := cursor.BackgroundFile
		if seen[baseName] {
			return true
		}
		seen[baseName] = true

		_, _ = fmt.Fprintf(stdout, "  [%s] ", baseName)

		// BackgroundFile is a bare name like "WarriorArms".
		// The actual BLP lives at Interface\TalentFrame\<name>-TopLeft.blp
		// (split into quadrants: TopLeft, TopRight, BottomLeft, BottomRight).
		// Try a single-file path first, then fall back to quadrant layout.

		// Try single-file path first (some clients).
		// MPQ listfiles may use varying case (e.g. "TALENTFRAME"),
		// so we try both the natural and uppercase variants.
		for _, dir := range []string{`Interface\TalentFrame\`, `Interface\TALENTFRAME\`} {
			singlePath := dir + baseName + `.blp`
			if extractBLPToWebP(readFile, singlePath, outDir, stdout) {
				_, _ = fmt.Fprintf(stdout, "OK (single)\n")
				extracted++
				return true
			}
		}

		// Try quadrant layout (vanilla client standard).
		for _, dir := range []string{`Interface\TalentFrame\`, `Interface\TALENTFRAME\`} {
			img := stitchTalentBackground(readFile, dir, baseName)
			if img == nil {
				continue
			}
			if err := writeWebP(img, outDir, baseName); err != nil {
				_, _ = fmt.Fprintf(stdout, "SKIP (write): %v\n", err)
				skipped++
				return true
			}
			_, _ = fmt.Fprintf(stdout, "OK (quadrants)\n")
			extracted++
			return true
		}

		_, _ = fmt.Fprintf(stdout, "SKIP (not found)\n")
		skipped++
		return true
	})
	if err != nil {
		return fmt.Errorf("iterate TalentTab.dbc: %w", err)
	}

	_, _ = fmt.Fprintf(stdout, "Extracted %d talent background files (%d skipped) to %s\n",
		extracted, skipped, outDir)
	return nil
}

// stitchTalentBackground composites the four quadrant tiles into one image.
// The tiles are unevenly sized (typically 256x256, 64x256, 256x128, 64x128),
// so the canvas comes from the tiles rather than a fixed size. Returns nil when
// the top-left tile is missing, which is how a wrong path prefix shows up.
func stitchTalentBackground(readFile func(string) ([]byte, error), dir, baseName string) image.Image {
	load := func(quadrant string) image.Image {
		data, err := readFile(dir + baseName + quadrant + `.blp`)
		if err != nil {
			return nil
		}
		img, err := decodeBLP2(data)
		if err != nil {
			return nil
		}
		return img
	}

	topLeft := load("-TopLeft")
	if topLeft == nil {
		return nil
	}
	topRight := load("-TopRight")
	bottomLeft := load("-BottomLeft")
	bottomRight := load("-BottomRight")

	width, height := topLeft.Bounds().Dx(), topLeft.Bounds().Dy()
	if topRight != nil {
		width += topRight.Bounds().Dx()
	}
	if bottomLeft != nil {
		height += bottomLeft.Bounds().Dy()
	}

	canvas := image.NewNRGBA(image.Rect(0, 0, width, height))
	place(canvas, topLeft, 0, 0)
	place(canvas, topRight, topLeft.Bounds().Dx(), 0)
	place(canvas, bottomLeft, 0, topLeft.Bounds().Dy())
	place(canvas, bottomRight, topLeft.Bounds().Dx(), topLeft.Bounds().Dy())
	return canvas
}

func place(dst *image.NRGBA, src image.Image, x, y int) {
	if src == nil {
		return
	}
	r := src.Bounds()
	draw.Draw(dst, image.Rect(x, y, x+r.Dx(), y+r.Dy()), src, r.Min, draw.Src)
}

func writeWebP(img image.Image, outDir, baseName string) error {
	outPath := filepath.Join(outDir, strings.ToLower(baseName)+".webp")
	out, err := os.Create(outPath)
	if err != nil {
		return err
	}
	if err := nativewebp.Encode(out, img, nil); err != nil {
		_ = out.Close()
		_ = os.Remove(outPath)
		return err
	}
	return out.Close()
}
