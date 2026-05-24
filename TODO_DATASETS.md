# Tenant Datasets — Per-Tenant Game Data & Log Types

Move WoW game data (spells, cast times, icons, etc.) from compiled-in build tags
to database-backed **datasets**. Each tenant picks a dataset and a set of
supported log types.

## Status Key
- [ ] Not started
- [x] Done
- [~] In progress

---

## 1. Database Schema

### 1.1 `datasets` table
- [ ] Create migration `NNNNNN_add_datasets.up.sql`

```sql
CREATE TABLE datasets (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,              -- "Vanilla 1.12", "V+", "Wrath 3.3.5a"
    slug          TEXT UNIQUE NOT NULL,       -- "vanilla-112", "vplus", "wrath-335a"
    wow_version   TEXT NOT NULL,             -- "1.12.2", "3.3.5a"
    build_version INT  NOT NULL DEFAULT 5875, -- vsn constant (5875=1.12.2, 12340=3.3.5a)
    description   TEXT NOT NULL DEFAULT '',
    -- Object-storage key for raw Spell.dbc
    spell_dbc_storage_key TEXT,
    -- Object-storage keys for generated JSON assets
    -- {"class-spells": "datasets/<id>/class-spells.json", ...}
    asset_keys    JSONB NOT NULL DEFAULT '{}',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE datasets ADD CONSTRAINT datasets_slug_format
    CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$');
```

### 1.2 dbcmem lookup tables (one per type, all FK → datasets)

Each table stores one dbcmem map type. The `entry_id` is the original DBC ID
(the map key in current Go code). All tables share the same pattern:
`(dataset_id, entry_id) → fields`.

- [ ] `dataset_spell_cast_times` — `entry_id INT, base INT, per_level INT, minimum INT`
- [ ] `dataset_spell_icons` — `entry_id INT, texture_filename TEXT`
- [ ] `dataset_spell_durations` — `entry_id INT, duration INT, duration_per_level INT, max_duration INT`
- [ ] `dataset_spell_ranges` — `entry_id INT, range_min REAL, range_max REAL, flags INT, name TEXT`
- [ ] `dataset_spell_categories` — `entry_id INT, flags INT, uses_per_week INT, name TEXT, max_charges INT, charge_recovery_time INT, type_mask INT`
- [ ] `dataset_spell_radii` — `entry_id INT, radius REAL, radius_per_level REAL, radius_min REAL, radius_max REAL`
- [ ] `dataset_spell_focus_objects` — `entry_id INT, name TEXT`
- [ ] `dataset_periodic_spells` — `entry_id INT, name TEXT, has_direct BOOLEAN`
- [ ] `dataset_vulnerability_spells` — `entry_id INT, name TEXT, school_bitmask INT, percent_affect INT, flat_affect INT` (nullable percent/flat)
- [ ] `dataset_extra_attack_spells` — `entry_id INT, name TEXT, num_extra_attacks INT`
- [ ] `dataset_duration_modifiers` — `entry_id INT, spell_id INT, name TEXT, percent INT, flat INT, deprecated BOOLEAN`
- [ ] `dataset_duration_modifiers_by_class_bit` — `spell_class_set INT, family_mask_bit BIGINT, modifier_spell_id INT`
  - (This is the flattened form of `map[int32]map[uint64][]int32`)

All tables: `PRIMARY KEY (dataset_id, entry_id)` (except `_by_class_bit` which
is `(dataset_id, spell_class_set, family_mask_bit, modifier_spell_id)`).

### 1.3 Tenant columns
- [ ] `ALTER TABLE tenants ADD COLUMN default_dataset_id UUID REFERENCES datasets(id);`
- [ ] `ALTER TABLE tenants ADD COLUMN supported_log_types log_type[] NOT NULL DEFAULT '{}';`
  - Empty array = all types allowed (backward-compatible).

### 1.4 sqlc queries
- [ ] New file `database/queries/datasets.sql`
  - `GetDataset`, `GetDatasetBySlug`, `ListDatasets`
  - `InsertDataset`, `UpdateDataset`, `DeleteDataset`
  - Bulk-insert queries for each lookup table (use `COPY`-style or multi-row VALUES)
  - Bulk-select queries: `GetDatasetSpellCastTimes(dataset_id) → []row`
- [ ] Extend `database/queries/tenants.sql`
  - `SetTenantDataset`, `SetTenantLogTypes`
- [ ] `make gen/db`

---

## 2. SDK Types & API

### 2.1 SDK types
- [ ] New `api/chroniclesdk/dataset.go` — `Dataset` struct (metadata only, no bulk data)
- [ ] Extend `api/chroniclesdk/tenant.go` — add `DefaultDatasetID *uuid.UUID`, `SupportedLogTypes []string`
- [ ] Update `TenantFromDB` conversion
- [ ] Update `UpsertTenantRequest` + `ToInsertParams`/`ToUpdateParams`

### 2.2 API endpoints (admin-only)
- [ ] `GET    /api/v1/datasets`               — list all
- [ ] `GET    /api/v1/datasets/{id}`           — get metadata
- [ ] `POST   /api/v1/datasets`               — create
- [ ] `PUT    /api/v1/datasets/{id}`           — update metadata
- [ ] `DELETE /api/v1/datasets/{id}`           — delete
- [ ] `PUT    /api/v1/datasets/{id}/spell-dbc` — upload Spell.dbc to object storage
- [ ] `POST   /api/v1/datasets/{id}/populate`  — bulk-upload dbcmem tables (JSON body)
- [ ] `PUT    /api/v1/datasets/{id}/assets/{name}` — upload generated asset JSON
- [ ] `GET    /api/v1/datasets/{id}/assets/{name}` — fetch asset JSON

### 2.3 Tenant endpoint changes
- [ ] `PUT /api/v1/tenants/{id}` — accept `default_dataset_id`, `supported_log_types`

### 2.4 Files
- `api/chroniclesdk/dataset.go` (new)
- `api/chroniclesdk/tenant.go` (extend)
- `api/datasets.go` (new handlers)
- `api/api.go` (register routes)

---

## 3. DBCMemProvider Interface

Decouple consumers from the `dbcmem` package-level globals so they can use
dataset-specific data.

### 3.1 Define interface
- [ ] In `database/gamedb/chrondbc/dbcmem/types.go`, add:
  ```go
  type Provider interface {
      GetCastTime(id int32) SpellCastTime
      GetSpellIcon(id int32) SpellIcon
      GetSpellDuration(id int32) SpellDuration
      GetSpellRange(id int32) SpellRange
      GetSpellCategory(id int32) SpellCategory
      GetSpellRadius(id int32) SpellRadius
      GetSpellFocusObject(id int32) SpellFocusObject
      GetPeriodicSpell(id int32) (PeriodicSpell, bool)
      GetVulnerabilitySpell(id int32) (VulnerabilitySpell, bool)
      GetExtraAttackSpell(id int32) (ExtraAttackSpell, bool)
      GetDurationModifier(id int32) (DurationModifier, bool)
      GetDurationModifiersByClassBit(classSet int32) (map[uint64][]int32, bool)
  }
  ```

### 3.2 Globals-backed default implementation
- [ ] Add `type GlobalProvider struct{}` that wraps existing package globals
  - So existing code can do `var DefaultProvider Provider = GlobalProvider{}`
  - This is the backward-compatible fallback

### 3.3 Thread provider through consumers
These files currently call `dbcmem.GetXxx()` or `dbcmem.XxxMap[key]` directly:
- [ ] `database/gamedb/chrondbc/durationcalc.go` — `MaxAuraDuration` uses `DurationModifiersByClassBit`, `DurationModifiers`
- [ ] `database/gamedb/chrondbc/types.go` — getter functions (these become the GlobalProvider impl)
- [ ] `internal/services/servicewowdb/servicewowdb.go` — `PeriodicSpells`
- [ ] `combatlog/parser/vanilla/synthetic/extrattack.go` — `ExtraAttackSpells`

### 3.4 Extend GameDB interface
- [ ] `database/gamedb/wowdb.go` — `GameDB` interface gains `DBCMem() dbcmem.Provider`
- [ ] `WoWDB` (compiled-in) returns `GlobalProvider`
- [ ] `DatasetGameDB` (new, Phase 4) returns its dataset-specific provider

---

## 4. Dataset-Aware WoWDB

### 4.1 DatasetGameDB
- [ ] New `database/gamedb/dataset.go`
  - Implements `GameDB` interface
  - Holds dataset-specific spell DBC + all 12 lookup maps
  - `DBCMem()` returns a provider backed by its maps (loaded from DB tables)

### 4.2 DatasetLoader
- [ ] New `database/gamedb/datasetloader.go`
  - `Load(ctx, datasetID) → (GameDB, error)`
  - LRU cache of loaded datasets (5–10 entries)
  - Steps: check cache → fetch dataset row → download Spell.dbc from object storage →
    bulk-select all 12 lookup tables → construct DatasetGameDB → cache → return
  - Cache eviction on dataset `updated_at` change

### 4.3 Integrate into servicewowdb
- [ ] `servicewowdb.Service` gains `datasetLoader *gamedb.DatasetLoader`
- [ ] New method: `GameDBForDataset(ctx, datasetID) → (GameDB, error)`
  - `uuid.Nil` → return compiled-in fallback
- [ ] Initialize loader in `Start()` (needs DB store + object storage)

---

## 5. Parser Integration

### 5.1 Resolve dataset before parsing
- [ ] In `chronicle/logparse.go` `WorkerLogParse.Work()`:
  - Look up log group → server → tenant → `default_dataset_id`
  - Call `GameDBForDataset(ctx, datasetID)` to get the right GameDB
  - Pass resolved GameDB to parser (replacing `w.parent.WoWDB`)
- [ ] `chronicle/chronicle.go` — add `WoWDBService` reference (for `GameDBForDataset`)

### 5.2 Log type validation at upload
- [ ] In `api/upload.go`:
  - After resolving tenant, check `supported_log_types`
  - If non-empty and log type not in list → HTTP 400
  - Empty list = allow all (backward-compatible)

---

## 6. Dataset Population Tooling

### 6.1 Export command
- [ ] `scripts/dbcdata export-dataset` — new CLI command
  - Reads DBC files, outputs JSON matching the bulk-upload API shape
  - Produces one JSON object with all 12 table types
  - Can be piped to `curl POST /api/v1/datasets/{id}/populate`

### 6.2 Seed from compiled-in data
- [ ] CLI command `chronicled dataset seed --from-compiled`
  - Creates a dataset row + populates all lookup tables from current dbcmem globals
  - Uploads the local Spell.dbc to object storage
  - Useful for bootstrapping existing deployments

### 6.3 Admin workflow
1. Create dataset → `POST /api/v1/datasets`
2. Upload Spell.dbc → `PUT /api/v1/datasets/{id}/spell-dbc`
3. Populate lookup tables → `POST /api/v1/datasets/{id}/populate`
4. Upload asset JSONs → `PUT /api/v1/datasets/{id}/assets/{name}`
5. Assign to tenant → `PUT /api/v1/tenants/{id}` with `default_dataset_id`

---

## 7. Frontend Asset Resolution

### 7.1 Dataset-aware assets service
- [ ] `serviceassets` resolves tenant → dataset → asset keys → object storage
- [ ] Fallback: no dataset → serve from compiled-in `./assets/{server}/generated/`

### 7.2 Spell icon CDN
- [ ] Include icon CDN base URL in dataset metadata (or derive from slug)
- [ ] Frontend `iconUrl()` reads from tenant/dataset context instead of `VITE_SERVER_NAME`

---

## Design Notes

### Backward Compatibility
- No dataset configured → compiled-in data (current behavior)
- Empty `supported_log_types` → all types allowed
- Existing binaries → unchanged
- `dbcmem` package globals → still populated by `init()` for compiled-in fallback

### Migration Path
1. Ship schema (§1) + SDK/API (§2)
2. Ship DBCMemProvider interface (§3) — refactor, no behavior change
3. Ship DatasetLoader + parser integration (§4–5) — feature flag or fallback
4. Seed datasets from compiled-in data (§6)
5. Assign datasets to tenants
6. Frontend resolution (§7) — last, can ship independently

### Memory Budget
- Each loaded dataset: Spell.dbc (~2–7 MB) + 12 lookup maps (~1–3 MB) ≈ 3–10 MB
- LRU cache of 5 datasets ≈ 15–50 MB total — acceptable

### Why Separate Tables (Not JSONB)
- Vanilla SpellIcons alone has ~4,000 entries; WotLK has ~10,000+
- Full dbcmem JSON blob estimated 2–5 MB per dataset
- Separate tables allow incremental writes, individual row queries, and future indexing
- Avoids PostgreSQL TOAST overhead on frequent reads
