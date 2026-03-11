---
name: generated-assets
description: >
  Pattern for adding generated JSON assets served by the Assets service.
  Use when: adding new DBC-derived data files, serving static JSON to the frontend,
  or working with the assets/generated/ directory and /api/v1/assets/ endpoint.
advertise: true
---

# Generated Assets Pattern

## Overview

Chronicle serves pre-generated JSON data files from `assets/generated/` via the **Assets service** (`serviceassets`). This avoids bundling large static data into the frontend JavaScript bundle. Files are served at `/api/v1/assets/{filename}` with 1-day HTTP caching.

## Architecture

```
Generator (scripts/dbcdata)          Assets Service              Frontend
─────────────────────────           ──────────────────          ─────────
scripts/dbcdata/cli/*.go  ──JSON──> assets/generated/*.json     React Query
  --assets-dir flag                 serviceassets.ServeHTTP()    fetch("/api/v1/assets/...")
                                    ↓                            staleTime: 24h
                                    /api/v1/assets/{file}.json
                                    Cache-Control: max-age=86400
```

## Key Files

| File | Purpose |
|------|---------|
| `internal/services/serviceassets/serviceassets.go` | Assets service: owns directory, validates filenames, serves JSON with caching |
| `scripts/dbcdata/cli/derivedstatics.go` | Generator orchestrator, `--assets-dir` flag |
| `scripts/dbcdata/cli/classspells.go` | Example: class spells JSON generator |
| `assets/generated/` | Output directory for generated JSON files |

## Adding a New Generated Asset

### 1. Create the collector in `scripts/dbcdata/cli/`

```go
// mydata.go
type myEntry struct {
    ID   int32  `json:"id"`
    Name string `json:"name"`
}

func collectMyData(wc *dbcdb.WoWClient) (map[string][]myEntry, error) {
    // ... iterate DBC data, return structured result
}
```

### 2. Add generator function and wire into `derivedstatics.go`

```go
func generateMyData(wc *dbcdb.WoWClient, assetsDir string) error {
    data, err := collectMyData(wc)
    if err != nil {
        return err
    }
    return writeJSON(filepath.Join(assetsDir, "my-data.json"), data)
}
```

Call it from `DerivedStaticsCmd()`:
```go
if err := generateMyData(wc, assetsDir); err != nil {
    return fmt.Errorf("generate my data: %w", err)
}
```

### 3. Frontend: Fetch via React Query

```typescript
const { data, isLoading } = useQuery({
  queryKey: ["assets", "my-data"],
  queryFn: async () => {
    const response = await fetch("/api/v1/assets/my-data.json");
    if (!response.ok) throw new Error("Failed to fetch");
    return response.json() as Promise<MyDataType>;
  },
  staleTime: 24 * 60 * 60 * 1000, // 1 day
});
```

## Conventions

- **Filename format**: `kebab-case.json` only (validated by regex `^[a-z0-9]+(-[a-z0-9]+)*\.json$`)
- **Directory**: `assets/generated/` (configurable via `--assets-generated-dir` flag / `CHRONICLE_ASSETS_GENERATED_DIR` env)
- **Caching**: 1-day `Cache-Control` on HTTP responses; 1-day `staleTime` in React Query
- **No auth required**: Asset endpoints are within the `/api/v1` route group but don't require authentication

## Assets Service API

```go
// Access service from broker
assets := serviceassets.Assets(broker)

// Read a file programmatically
data, err := assets.ReadFile("class-spells.json")

// Get directory path (for generators)
dir := assets.Dir()

// Mount as HTTP handler (done in api.go)
r.Mount("/assets", api.Opts.Assets)
```

## Running the Generator

```bash
# Generate all derived statics including JSON assets
go run ./scripts/dbcdata derived-statics \
  --go-dir ./database/gamedb/chrondbc/dbcmem \
  --ts-dir ./frontend/chronicle/src/constants/dbmem \
  --assets-dir ./assets/generated \
  --dbc /path/to/wow/client
```
