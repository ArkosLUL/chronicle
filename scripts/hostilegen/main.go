// Command hostilegen downloads the AzerothCore WotLK database SQL dumps
// and generates Go source files containing HostilesX() functions and
// CommonFactory definitions for all dungeon and raid instances.
//
// Usage:
//
//	go run ./scripts/hostilegen --output-dir=gen_output
//	go run ./scripts/hostilegen --output-dir=gen_output --cache-dir=/tmp/ac-sql
package main

import (
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
)

const baseURL = "https://raw.githubusercontent.com/azerothcore/database-wotlk/master/sql/base/"

func main() {
	outputDir := flag.String("output-dir", "gen_output", "directory to write generated Go files")
	cacheDir := flag.String("cache-dir", "", "directory to cache downloaded SQL files (uses temp dir if empty)")
	flag.Parse()

	if err := run(*outputDir, *cacheDir); err != nil {
		log.Fatal(err)
	}
}

func run(outputDir, cacheDir string) error {
	if err := os.MkdirAll(outputDir, 0o755); err != nil {
		return fmt.Errorf("create output dir: %w", err)
	}

	if cacheDir == "" {
		d, err := os.MkdirTemp("", "hostilegen-*")
		if err != nil {
			return fmt.Errorf("create cache dir: %w", err)
		}
		cacheDir = d
		log.Printf("Using temp cache dir: %s", cacheDir)
	}

	// ---- Download ----
	log.Println("Downloading creature_template.sql...")
	ctData, err := downloadOrCache(cacheDir, "creature_template.sql")
	if err != nil {
		return err
	}

	log.Println("Downloading creature.sql...")
	cData, err := downloadOrCache(cacheDir, "creature.sql")
	if err != nil {
		return err
	}

	log.Println("Downloading instance_encounters.sql...")
	ieData, err := downloadOrCache(cacheDir, "instance_encounters.sql")
	if err != nil {
		return err
	}

	// ---- Parse ----
	log.Println("Parsing creature_template.sql...")
	templates := parseCreatureTemplates(ctData)
	log.Printf("  %d creature templates", len(templates))

	log.Println("Parsing creature.sql...")
	mapCreatures := parseCreatureSpawns(cData)
	log.Printf("  creatures across %d maps", len(mapCreatures))

	log.Println("Parsing instance_encounters.sql...")
	encounterBosses := parseInstanceEncounters(ieData)
	log.Printf("  %d encounter boss entries", len(encounterBosses))

	// ---- Build ----
	log.Println("Building instance data...")
	instanceData := buildAllInstances(templates, mapCreatures, encounterBosses)
	log.Printf("  %d instances with data", len(instanceData))

	// ---- Generate ----
	log.Println("Generating Go source files...")
	if err := generateAllFiles(outputDir, instanceData); err != nil {
		return err
	}

	log.Println("Done!")
	return nil
}

func downloadOrCache(cacheDir, filename string) ([]byte, error) {
	cachePath := filepath.Join(cacheDir, filename)
	if data, err := os.ReadFile(cachePath); err == nil {
		log.Printf("  Using cached %s (%d bytes)", cachePath, len(data))
		return data, nil
	}

	url := baseURL + filename
	resp, err := http.Get(url) //nolint:gosec,noctx
	if err != nil {
		return nil, fmt.Errorf("download %s: %w", filename, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("download %s: HTTP %d", filename, resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", filename, err)
	}
	log.Printf("  Downloaded %s (%d bytes)", filename, len(data))

	// Cache for re-runs.
	_ = os.MkdirAll(cacheDir, 0o755)
	_ = os.WriteFile(cachePath, data, 0o644)

	return data, nil
}
