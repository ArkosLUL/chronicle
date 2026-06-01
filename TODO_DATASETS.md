# Tenant Datasets: Per-Tenant Game Data

Move WoW game data (spells, cast times, icons, talents, etc.) from compiled-in
build tags to database-backed **datasets**, so a single binary can serve
multiple WoW versions/flavors. Game data is scoped per dataset; user data stays
scoped per tenant.

## Status Key
- [ ] Not started
- [x] Done
- [~] In progress

---

## Shipped (PR #114)

The foundation plus the first end-to-end data type (talents) shipped. The plan
below has been reconciled against what was actually built; some original
decisions changed during implementation (notably: explicit `WHERE` instead of
RLS, and JSONB is allowed for document-shaped data). Durable architecture is
captured in the vault entry `chronicle-dataset-architecture`.

**Datasets entity + scoping**
- [x] `datasets` table, `servicedataset` CRUD service, admin routes (Tasks A–C)
- [x] `default_dataset_id` on `tenants` and `wow_servers`
- [x] **Well-known default dataset** (`00000000-0000-0000-0000-000000000001`)
  inserted by migration; `wow_version`/`build_version` upserted at startup from
  build tags (`servicedataset.ensureDefaultDataset`)
- [x] `dataset_id` added to all 15 `world_*`/`dbc_*` tables as part of a
  **composite PK** `(dataset_id, <orig pk>)`; existing rows backfilled to default
- [x] All `world_data.sql` queries + gamedataapi raw-SQL upserts scoped by
  explicit `dataset_id` (NOT RLS — see Architecture Decisions)

**Talents (the proof-of-pattern, fully migrated)**
- [x] `dataset_talent_trees` JSONB table + `gamedb/talents.TalentFetcher`
  (per-dataset LRU cache)
- [x] `GET /wowdb/talent-trees` — optional `dataset_id`; resolves explicit param
  > tenant default > server default; **404 → graceful empty state** when no data
- [x] Static `assets/*/generated/talent-trees.json` + `generateTalentTrees` removed

**Cross-tenant dataset resolution**
- [x] `ResolveDatasetByRealm` query (realm → server → COALESCE(server, tenant) → default)
- [x] `dataset_id` stamped onto instance + armory API responses; frontend forwards
  it to `TalentTreeViewer` (armory tab, equipment panel, standalone selector)
- [x] `X-Chronicle-Dataset` response header for debugging

**Import tooling + auth**
- [x] `dbcdata import` CLI: importer registry (dedup DBC extraction), bubbletea
  TUI (dataset selector + molly guard), `--export-as=files`, `--api-url` upload
- [x] Bearer token auth in `AuthenticationMiddleware`; `GET /whoami/dump`
  (custom-header CSRF guard); `--cookie` exchange in the CLI

---

## Agent Task Guide

This plan is structured for parallel agent execution. Each **Task** below is
independent and self-contained. Dependencies between tasks are explicit.

**Key conventions every agent must follow:**
- Read `AGENTS.md` at repo root before writing any code
- Run `make gen/db` after changing migrations or queries
- Run `make lint` and `make test` (with `-tags turtle`) before claiming done
- Use `./database/migrations/create_migration.sh "description"` to get the next
  migration number (do NOT hardcode a number — it may have advanced)
- Follow the `database/queries/tenants.sql` `COALESCE(sqlc.narg(...), col)` pattern for updates
- `servicedataset` gets its DB store via `servicedbstore.DatabaseStore(broker)` (NOT direct pool)
- Dataset scoping is **explicit `WHERE dataset_id = $n`**, NOT RLS. RLS is
  tenant-only. Do not add dataset logic to `servicetenant`'s `PrepareConn` hooks.
- All `world_*`/`dbc_*` tables now carry `dataset_id` in their composite PK
  (including creatures and items — the original "creatures not dataset-scoped"
  note no longer holds; everything game-data is dataset-scoped, currently all on
  the default dataset until each type is migrated).
- The `GameDB` interface composes per-type `Fetcher`s (see `gamedb/talents` for
  the pattern). New fetchers are dataset-scoped and injected via `Options`.
- REALM_INFO extraction happens during parsing (not pre-scanned). The future
  pre-scan solution should be a separate lightweight pass OUTSIDE the parser,
  not added to `parsectx` (keep it minimal).
- Object storage uses buckets. Combat logs are in bucket `raidlogs` with key
  pattern `logs/{fileID}`. DBC files go in a new bucket (e.g. `datasets`) with
  key pattern `datasets/{datasetID}/{filename}`.

---

## Task A: Migration + sqlc Queries

**Dependencies:** None
**Scope:** Database schema only. No Go service code.

- [x] Run `./database/migrations/create_migration.sh "add_datasets"` to get next number
- [x] Write the up migration:

```sql
CREATE TABLE datasets (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    slug          TEXT UNIQUE NOT NULL,
    wow_version   TEXT NOT NULL,
    build_version INT  NOT NULL DEFAULT 5875,
    description   TEXT NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE datasets ADD CONSTRAINT datasets_slug_format
    CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$');

ALTER TABLE tenants ADD COLUMN default_dataset_id UUID REFERENCES datasets(id);
ALTER TABLE wow_servers ADD COLUMN default_dataset_id UUID REFERENCES datasets(id);
```

- [x] Write down migration: drop columns first (order matters for FK), then table
- [x] New `database/queries/datasets.sql`:
  - `GetDataset :one` — `SELECT * FROM datasets WHERE id = $1`
  - `GetDatasetBySlug :one` — `SELECT * FROM datasets WHERE slug = $1`
  - `ListDatasets :many` — `SELECT * FROM datasets ORDER BY name`
  - `InsertDataset :one` — all fields, `RETURNING *`
  - `UpdateDataset :one` — COALESCE pattern (match `UpdateTenant` in `tenants.sql`)
  - `DeleteDataset :exec` — `DELETE FROM datasets WHERE id = $1`
- [x] Add to `database/queries/tenants.sql`:
  - `SetTenantDataset :exec` — `UPDATE tenants SET default_dataset_id = $2, updated_at = now() WHERE id = $1`
- [x] Add to `database/queries/azerothcore.sql`:
  - `SetServerDataset :exec` — `UPDATE wow_servers SET default_dataset_id = $2 WHERE id = $1`
- [x] `make gen/db`
- [x] Verify: `go build -tags turtle ./...` passes

**Acceptance:** Migration applies cleanly; sqlc generates without errors; build passes.

---

## Task B: SDK Types

**Dependencies:** Task A (needs generated DB types)
**Scope:** SDK types + conversion functions only. No handlers, no service.

- [x] New `api/chroniclesdk/dataset.go`:
  ```go
  type Dataset struct {
      ID           uuid.UUID `json:"id"`
      Name         string    `json:"name"`
      Slug         string    `json:"slug"`
      WoWVersion   string    `json:"wow_version"`
      BuildVersion int       `json:"build_version"`
      Description  string    `json:"description"`
      CreatedAt    time.Time `json:"created_at"`
      UpdatedAt    time.Time `json:"updated_at"`
  }
  ```
  - `DatasetFromDB(database.Dataset) Dataset`
  - `UpsertDatasetRequest` struct with pointer fields for optional update
  - `ToInsertParams()` / `ToUpdateParams()` methods (match `UpsertTenantRequest` pattern)
- [x] Extend `api/chroniclesdk/tenant.go`:
  - Add `DefaultDatasetID *uuid.UUID `json:"default_dataset_id"`` to `Tenant`
  - Update `TenantFromDB` — read `t.DefaultDatasetID` (it's `uuid.NullUUID`)
  - Add `DefaultDatasetID *uuid.UUID` to `UpsertTenantRequest`
  - Update `ToInsertParams`/`ToUpdateParams` to handle it
- [x] Run `make gen` to regenerate TypeScript types
- [x] Verify: `go build -tags turtle ./...` passes

**Acceptance:** Types compile; frontend types regenerated; no existing tests break.

---

## Task C: `servicedataset` Service + Wiring

**Dependencies:** Task A, Task B
**Scope:** New service package, registration, route mounting. The service handles
dataset CRUD only (no DBC upload, no dataset-aware WoWDB).

### C1: Service scaffold
- [x] Add `ServiceDataset = "dataset"` to `internal/services/servicenames.go`
- [x] Create `internal/services/servicedataset/servicedataset.go`:
  - `Service` struct with `broker *services.Services`, `db database.Store`
  - `New(broker) *Service`
  - `Name() → services.ServiceDataset`
  - `DependsOn() → [servicelogger.OnLogger(), servicedbstore.OnDatabaseStore()]`
  - `Configures() → nil`
  - `Options() → nil` (no CLI flags needed yet)
  - `Start()` — get DB from `servicedbstore.DatabaseStore(s.broker)`
  - `Close() → nil`
  - Export helpers: `OnDataset()`, `Dataset(broker)`

### C2: Handlers
- [x] Create `internal/services/servicedataset/handler.go`:
  - `Routes() http.Handler` — chi router
    - `GET /` → List
    - `POST /` → Upsert (create)
    - `GET /{datasetID}` → Get
    - `PUT /{datasetID}` → Upsert (update)
    - `DELETE /{datasetID}` → Delete
  - All handlers use `servicetenant.AdminBypass(ctx)` for DB queries (datasets
    table is not behind RLS)
  - Follow `servicetenant/handler.go` patterns exactly

### C3: Context helpers
- [x] Create `internal/services/servicedataset/context.go`:
  - `WithDatasetID(ctx, uuid.UUID) context.Context`
  - `DatasetIDFromContext(ctx) uuid.UUID` (returns `uuid.Nil` if unset)

### C4: Wiring
- [x] `cmd/chronicled/cli/server.go` — add `servicedataset.New(srvs)` to `srvs.Register()`
  (place after `serviceassets`, before `servicechronicle`)
- [x] `api/api.go` — add `Dataset *servicedataset.Service` to `Options` struct
- [x] `api/api.go` `Routes()` — mount under admin:
  ```go
  r.Route("/datasets", func(r chi.Router) {
      r.Use(httpmw.Can(api.Zed, policy.New().GlobalChronicle().CanAdmin_tenants_User))
      r.Mount("/", api.Opts.Dataset.Routes())
  })
  ```
- [x] `internal/services/serviceapi/serviceapi.go` — retrieve and pass dataset service:
  ```go
  datasetSvc := servicedataset.Dataset(s.broker)
  // add to api.Options{Dataset: datasetSvc}
  ```

- [x] Verify: `make lint`, `make build`, endpoints reachable (manual or test)

**Acceptance:** Service starts, routes registered, CRUD operations work. Existing
tests pass. `make lint` clean.

---

## Task D: Dataset Scoping (DONE — but NOT the way originally planned)

**Original plan (REJECTED):** propagate `dataset_id` via an `app.dataset_id`
session variable and RLS, mirroring tenant RLS.

**What shipped instead:** **explicit `WHERE dataset_id = $n`** on every
game-data query. RLS is reserved for `tenant_id` (user data). Datasets are plain
foreign-key scoping. This is the deliberate, load-bearing decision — do not
reintroduce `app.dataset_id` / RLS for datasets. See Architecture Decisions.

How the dataset is chosen per request/operation:

- [x] **Read endpoints that resolve from data:** instance/armory call
  `servicedataset.ResolveDatasetForRealm(ctx, realmID)` (realm → server →
  tenant → default) and stamp `dataset_id` on the response.
- [x] **WoWDB talent endpoint:** optional `?dataset_id`, else tenant-context
  default, else compiled default.
- [x] **Item/creature fetchers + gamedataapi:** carry an explicit `datasetID`,
  currently `DefaultDatasetID` until each type is migrated.
- [x] Context helpers `WithDatasetID`/`DatasetIDFromContext` exist in
  `servicedataset` for handlers that need to pass a resolved dataset down.

**Acceptance:** met. No `app.dataset_id` session variable exists; scoping is
explicit and tested via the migration round-trip + build/lint.

---

## Architecture Decisions

### Dataset Scoping: Explicit `WHERE`, NOT RLS (changed from original plan)

Datasets and tenants use **different** mechanisms on purpose:

- **Tenants** scope user-generated data (logs, armory, guild pages) via Postgres
  **RLS** + the `app.tenant_id` session variable.
- **Datasets** scope game reference data (spells, items, talents) via **explicit
  `WHERE dataset_id = $n`** in every query. No session variable, no RLS.

The original plan proposed an `app.dataset_id` session variable mirroring tenant
RLS. That was rejected: game data is not a security boundary, so RLS adds
complexity for no benefit, and explicit scoping is easier to read and test.

How the dataset is resolved per request:

```
Request that references game data (instance / armory)
  → ResolveDatasetForRealm(realmID): realm → server.default_dataset_id
                                     → tenant.default_dataset_id → compiled default
  → dataset_id stamped on the response body + X-Chronicle-Dataset header
  → frontend forwards dataset_id to game-data fetches (e.g. talent trees)

Direct game-data endpoint (e.g. /wowdb/talent-trees)
  → explicit ?dataset_id, else request tenant's default, else compiled default
```

### Primary Domain Problem (No Tenant → No Dataset)

Realm is detected **during** parsing from `REALM_INFO` in the combat log, but
WoWDB is needed **before** parsing starts. REALM_INFO is processed by the line
matcher during full parse (not pre-scanned). The `parsectx` package only carries
`LogType` — keep it minimal.

**Future solution (decided):** Pre-scan REALM_INFO before full parse. This is a
separate lightweight pass **outside** the parser (do NOT add fields to `parsectx`).
Resolve `realm → server → dataset`, then parse with the correct WoWDB.

**Current fallback:** No dataset in context → compiled-in data via build tags.

### Dataset Lives on Both `tenants` and `wow_servers`

Resolution order: `server.default_dataset_id` > `tenant.default_dataset_id` > compiled-in fallback.

Rationale: servers define their game version. A tenant with multiple servers
(e.g. Vanilla + TBC) needs per-server datasets. Tenant-level is the fallback
for single-server tenants that don't configure per-server.

### GameDB Interface — What's Dataset-Scoped vs Shared

```
GameDB interface
├── SpellFetcher       ← dataset-scoped (from DBC files)
├── GearResolver       ← shared/world-scoped (from internal_game_data DB)
├── CreatureFetcher    ← shared/world-scoped (from internal_game_data DB)
└── DBCMem() Provider  ← dataset-scoped (future, from dbcmem lookup tables)
```

`DatasetGameDB` only replaces `SpellFetcher` + `DBCMem()`. Gear and creature
lookups remain on the shared `WoWDB` regardless of dataset.

### JSONB vs Separate Tables: Pick by Shape (refined during implementation)

The original plan said "never JSONB, always separate tables." Implementation
refined this: **choose by data shape.**

- **Document-shaped, read as a whole, never queried per-row → JSONB.**
  Talents shipped this way: `dataset_talent_trees(dataset_id PK, data JSONB)`.
  The frontend always fetches the entire tree blob; there is no "find talent #56
  across datasets" query. One row per dataset, one fetch, cached. Simple.

- **Row-queryable, individually looked up by ID → separate table.**
  Spells/icons/items: looked up by `entry_id` on hot paths, written
  incrementally, large (Vanilla SpellIcons ~4,000 entries; WotLK ~10,000+).
  A `(dataset_id, entry_id)` table avoids TOAST overhead on frequent reads and
  supports per-row queries. Use the per-type tables listed under Future Tasks.

Rule of thumb: if the consumer always loads the whole thing, JSONB; if it looks
up individual entries, a table.

### DBC File Storage

DBC files are stored in object storage under a convention-based prefix:

```
bucket: datasets
key pattern: datasets/{dataset_id}/{filename}

datasets/{dataset_id}/
├── Spell.dbc
├── SpellIcon.dbc
├── SpellCastTimes.dbc
├── SpellDuration.dbc
└── ...
```

No DB column needed — the prefix is derived from `datasets/{id}/`. Different
datasets can have different sets of DBC files (Vanilla has fewer than WotLK).
Reload/re-process a dataset by reading its DBC files back from storage.

---

## Future Tasks (remaining data-type migrations)

The foundation is shipped. Each remaining game-data type is migrated
**independently, end-to-end**, following the recipe that talents proved.

### Per-data-type migration recipe (proven by talents)

For each data type, in one PR:

1. **Storage** — pick JSONB (document-shaped) or a `(dataset_id, entry_id)`
   table (row-queryable). See the JSONB-vs-tables decision above.
2. **Fetcher** — a `gamedb/<type>` package with a narrow `Fetcher` interface +
   per-dataset LRU cache; `database.Store` satisfies the narrow querier
   implicitly. Define a sentinel `ErrNo<Type>Data` for the empty case.
3. **WoWDB wiring** — add the fetcher to the `GameDB` interface + `Options`,
   inject at startup.
4. **Endpoint** — serve via WoWDB; `dataset_id` optional (resolve from context);
   **404 → graceful empty state** when not imported.
5. **Importer** — add an `Importer` to the `dbcdata import` registry
   (declare `RequiredFiles()`; raw-DBC passthrough or compute-then-upload).
6. **Frontend** — fetch with the resolved `dataset_id` (already on instance/
   armory responses); handle 404 gracefully.
7. **Cleanup** — once populated in prod, delete the static asset + its
   `generate*` step (do this only after the import has run in prod).

Keep each type a separate PR so behavior changes are isolated and reviewable.

### Future: class-spells (next up — direct sibling of talents)

`class-spells.json` is still generated by `derived-statics` into
`assets/*/generated/`. It is document-shaped (frontend loads the whole map), so
it follows the talents recipe almost verbatim: JSONB table
`dataset_class_spells`, a `gamedb/classspells` fetcher, a `/wowdb/class-spells`
endpoint, a `class-spells` importer, then remove the static asset + generation.
This is the lowest-risk next migration.

### Future: DBC Upload Endpoints
- [ ] `PUT /api/v1/datasets/{id}/dbc/{filename}` — upload any DBC file
- [ ] `GET /api/v1/datasets/{id}/dbc` — list stored DBC files
- [ ] `GET /api/v1/datasets/{id}/dbc/{filename}` — download a DBC file
- [ ] `DELETE /api/v1/datasets/{id}/dbc/{filename}` — remove a DBC file
- [ ] Create `datasets` bucket in object storage on service startup

### Future: dbcmem Lookup Tables (one per type, all FK → datasets)

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

All tables: `PRIMARY KEY (dataset_id, entry_id)` (except `_by_class_bit` which
is `(dataset_id, spell_class_set, family_mask_bit, modifier_spell_id)`).

### Future: DBCMemProvider Interface

Decouple consumers from the `dbcmem` package-level globals so they can use
dataset-specific data.

- [ ] `dbcmem.Provider` interface in `database/gamedb/chrondbc/dbcmem/types.go`
- [ ] `GlobalProvider struct{}` wrapping existing package globals (backward-compat fallback)
- [ ] Thread provider through consumers:
  - `database/gamedb/chrondbc/durationcalc.go`
  - `internal/services/servicewowdb/servicewowdb.go`
  - `combatlog/parser/vanilla/synthetic/extrattack.go`
- [ ] `GameDB` interface gains `DBCMem() dbcmem.Provider`

### Future: Dataset-Aware WoWDB

- [ ] `DatasetGameDB` type implementing `SpellFetcher` + `DBCMem()`
  (delegates `GearResolver` and `CreatureFetcher` to shared `WoWDB`)
- [ ] `DatasetLoader` — LRU cache of loaded datasets
- [ ] `servicewowdb.GameDBForDataset(ctx, datasetID)` — returns dataset-specific or fallback

### Future: Parser Integration

- [ ] Resolve dataset in `WorkerLogParse.Work()`: log group → server → tenant → dataset
- [ ] Pre-scan REALM_INFO (lightweight pass outside parser) for primary domain uploads
- [ ] Log type validation at upload (`supported_log_types` on tenant)

### Future: Dataset Population Tooling

- [ ] `scripts/dbcdata export-dataset` — output JSON from DBC files for bulk API upload
- [ ] `chronicled dataset seed --from-compiled` — bootstrap datasets from current dbcmem globals
- [ ] `POST /api/v1/datasets/{id}/populate` — bulk-upload dbcmem tables

### Future: Frontend Asset Resolution

- [ ] `serviceassets` resolves tenant → dataset → object storage for JSON assets
- [ ] Spell icon CDN becomes dataset-aware
- [ ] Frontend `iconUrl()` uses dataset context instead of `VITE_SERVER_NAME`

### Future: Prometheus Metrics

Instrument WoWDB with Prometheus metrics to observe cache behavior and access
patterns. These drive caching strategy decisions.

**Cache metrics** (per cache, labeled by `dataset_id` where per-dataset):
- `wowdb_cache_size` (gauge) — current entries
- `wowdb_cache_capacity` (gauge) — max capacity
- `wowdb_cache_hits_total` (counter) — labeled by `cache` (spell, icon, cast_time, …)
- `wowdb_cache_misses_total` (counter)
- `wowdb_cache_evictions_total` (counter)

**Query metrics** (labeled by `data_type` and `dataset_id`):
- `wowdb_queries_total` (counter)
- `wowdb_query_duration_seconds` (histogram)
- `wowdb_query_errors_total` (counter)

**Dataset loader metrics:**
- `wowdb_dataset_loads_total` (counter)
- `wowdb_dataset_load_duration_seconds` (histogram)
- `wowdb_datasets_loaded` (gauge)

### Future: Remove Compiled-In Data

The end goal is to **remove all compiled-in static assets entirely**:
- `dbcmem` package globals → deleted
- Build-tagged wiring files (`server_turtle.go` etc.) → deleted
- `assets/{server}/` directories → deleted
- `services.ServerName` / `services.ServerBuild` → no longer needed for data selection
- `Makefile SERVER=turtle` → no longer selects game data

Each deployment becomes a single generic binary. Datasets are loaded at runtime.

---

## Design Notes

### WoWDB as the Universal Game Data Gateway

WoWDB becomes the **primary method of accessing anything related to the game
client**. All consumers (parsers, tooltip API, periodic spell lookup, duration
calc, extra attacks, frontend assets) go through WoWDB.

WoWDB will inject **hot caches** that can span datasets or be per-dataset:

```
WoWDB
├── DatasetLoader (loads full datasets from DB + object storage)
│   └── per-dataset LRU (DatasetGameDB instances, keyed by dataset_id)
│
├── Spell LRU (cross-dataset? per-dataset? TBD)
├── SpellIcon LRU
├── Cast Time LRU
└── ... other per-table caches
```

**Open questions on caching strategy:**
- Per-dataset LRUs: simple isolation, higher memory, no cross-dataset sharing
- Cross-dataset LRUs: keyed by `(dataset_id, entry_id)`, saves memory if
  datasets overlap (e.g. Vanilla spells shared by V+ and Turtle)
- Hybrid: per-dataset for the full DatasetGameDB object, cross-dataset for
  individual hot-path lookups (spell by ID, icon by ID)
- Decision deferred — implement per-dataset first, measure with metrics, then optimize

### Backward Compatibility (During Migration)
- No dataset configured → compiled-in data (current behavior, temporary)
- Empty `supported_log_types` → all types allowed
- Existing binaries → unchanged until compiled-in data is removed

### Execution Order
1. ✅ **Foundation (shipped, PR #114)** — datasets table, SDK, CRUD service,
   composite-PK migration, explicit `dataset_id` scoping, realm resolver,
   import CLI + auth. (Tasks A–C done; Task D done via explicit scoping, not RLS.)
2. ✅ **Talents** — first data type migrated end-to-end (the recipe).
3. **class-spells** — next, direct sibling of talents (document-shaped/JSONB).
4. dbcmem lookup tables (row-queryable types: spells, icons, cast times, …),
   one type at a time via the recipe.
5. DBCMemProvider interface + GlobalProvider refactor (decouple consumers from
   `dbcmem` globals so dataset-specific data can be threaded through).
6. DatasetLoader + DatasetGameDB + servicewowdb integration.
7. Parser integration (resolve dataset: log group → server → tenant → default;
   pre-scan REALM_INFO for primary-domain uploads).
8. DBC upload endpoints + object storage bucket (if raw-file storage is needed).
9. Population tooling (export, seed from compiled).
10. Frontend asset resolution (icons CDN dataset-aware).
11. Prometheus metrics (drive caching strategy).
12. Remove compiled-in data (delete `dbcmem` globals, build-tag wiring,
    `assets/{server}/`).

### Memory Budget
- Each loaded dataset: DBC files (~2–7 MB) + 12 lookup maps (~1–3 MB) ≈ 3–10 MB
- LRU cache of 5 datasets ≈ 15–50 MB total — acceptable
- Hot caches for individual lookups: TBD based on access patterns
