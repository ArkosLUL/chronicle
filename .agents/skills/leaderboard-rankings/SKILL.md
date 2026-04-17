---
name: leaderboard-rankings
description: >
  Rankings and leaderboard system for Chronicle. Covers speedrun tracking (parser-side kill detection),
  leaderboard queries with version filtering, admin-configurable version requirements, and the semver
  encoding scheme for SQL-side comparison. Use when: adding ranking types, modifying speedrun rules,
  changing version requirements, or working with the leaderboard API/UI.
advertise: true
---

# Leaderboard & Rankings System

## Architecture Overview

The rankings system has two layers:

1. **Parser-side detection** — computes rankings during combat log parsing (e.g., speedrun timing)
2. **Database + API + Frontend** — stores results, serves leaderboard queries, displays proof

```
Combat Log → Parser → SpeedrunTracker → FinalizedInstance.Rankings
                                              ↓
                                    logparse.go (InsertInstanceSpeedrun)
                                              ↓
                                    instance_speedruns table
                                              ↓
                              GET /api/v1/leaderboard/speedrun
                              GET /api/v1/raidlogs/instances/{id}/speedrun
```

## Rankings Package

**Location:** `combatlog/parser/vanilla/state/encounters/instances/rankings/`

### Types (rules — input, JSON-serializable for frontend)

```go
type Rankings struct {
    Speedrun *SpeedrunRules `json:"speedrun,omitempty"`
}

type SpeedrunRules struct {
    Requirements []SpeedrunRequirement `json:"requirements"`
}

type SpeedrunRequirementCategory string
const (
    SpeedrunCategoryBosses SpeedrunRequirementCategory = "Bosses"
    SpeedrunCategoryTrash  SpeedrunRequirementCategory = "Trash"
)

type SpeedrunRequirement struct {
    Name     string                      `json:"name"`
    EntryIDs []uint32                    `json:"entry_ids"`
    Count    int                         `json:"count"`
    Category SpeedrunRequirementCategory `json:"category"`
}
```

### Types (proof — output)

```go
type RankingsResult struct {
    Speedrun *SpeedrunResult
}

type SpeedrunResult struct {
    Qualified      bool
    StartTime      time.Time
    CompletionTime time.Time
    Duration       time.Duration
    Proof          []SpeedrunProof
}

type SpeedrunProof struct {
    Requirement SpeedrunRequirement
    Kills       []KillRecord
    Satisfied   bool
}

type KillRecord struct {
    EntryID   uint32
    GUID      guid.GUID
    Timestamp time.Time
}
```

### SpeedrunTracker

**Dual-hook pattern** — implements both:
- `instancehook.Hook` for `FightStarted`/`FightEnded`
- `character.SetHook` for `ActivityChange` kill detection

This is necessary because some bosses (e.g., Majordomo Executus) never emit `*messages.Slain` — they surrender/despawn. The character system marks them `EndStateSlain` through custom character handlers.

**Key logic:**
- `FightStarted` — records first combat timestamp (only once)
- `ActivityChange` — checks inactive characters with `EndStateSlain`, deduplicates by GUID, tracks kills per requirement
- `FightEnded` — when all requirements satisfied, marks `completed` and records completion time
- `Result()` — always returns non-nil `*SpeedrunResult` with proof for every requirement

### Wiring Instance Rules

Rules are defined per instance in `instances/speedrun_rules.go` and wired via `CommonFactory`:

```go
// instances/instances.go
{
    Name:     "Molten Core",
    Rankings: &rankings.Rankings{
        Speedrun: &rankings.SpeedrunRules{
            Requirements: MoltenCoreSpeedrunRequirements(),
        },
    },
}
```

Requirements use `Category` to group display in the UI (e.g., "Bosses" vs "Trash").
When `Count > 1`, the frontend displays `×N` suffix.

### Adding a New Instance's Speedrun Rules

1. Create requirements function in `instances/speedrun_rules.go`
2. Wire into the instance's `CommonFactory` in `instances/instances.go`
3. Reparse existing logs to populate data

## Database Schema

### `instance_speedruns` table (migration 000065 + 000066)

```sql
CREATE TABLE instance_speedruns (
    instance_id UUID PRIMARY KEY REFERENCES log_instances(id) ON DELETE CASCADE,
    instance_name TEXT NOT NULL,
    realm_id UUID NOT NULL REFERENCES wow_server_realms(id),
    guild_id UUID REFERENCES guilds(id),
    qualified BOOLEAN NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    completion_time TIMESTAMPTZ NOT NULL,
    duration_ms BIGINT NOT NULL,
    proof JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Version columns (migration 000066)
    addon_version TEXT NOT NULL DEFAULT '',
    parser_version_num BIGINT NOT NULL DEFAULT 0,
    addon_version_num BIGINT NOT NULL DEFAULT 0
);
```

### `leaderboard_version_requirements` table (migration 000066)

```sql
CREATE TABLE leaderboard_version_requirements (
    instance_name TEXT PRIMARY KEY,
    min_parser_version TEXT NOT NULL DEFAULT '',
    min_parser_version_num BIGINT NOT NULL DEFAULT 0,
    min_addon_version TEXT NOT NULL DEFAULT '',
    min_addon_version_num BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Admin-configurable. Human-readable version strings stored alongside encoded integers.

### Leaderboard Query

```sql
SELECT DISTINCT ON (COALESCE(li.duplicate_group_id, li.id))
    sr.*, li.hashed_slug, li.parser_version, ...
FROM instance_speedruns sr
JOIN log_instances li ON li.id = sr.instance_id
LEFT JOIN leaderboard_version_requirements lvr ON lvr.instance_name = sr.instance_name
WHERE sr.instance_name = @instance_name
  AND sr.qualified = true
  AND sr.parser_version_num >= COALESCE(lvr.min_parser_version_num, 0)
  AND sr.addon_version_num >= COALESCE(lvr.min_addon_version_num, 0)
ORDER BY COALESCE(li.duplicate_group_id, li.id), sr.duration_ms ASC;
```

Key behaviors:
- `DISTINCT ON` with duplicate group — only fastest run per duplicate group appears
- Version filtering via `LEFT JOIN` on requirements — if no requirements set, all qualified runs pass
- `COALESCE(..., 0)` — missing requirements default to 0 (no filter)

## Semver Encoding (`internal/semverenc`)

Converts semver strings to a single `BIGINT` for SQL `>=` comparison:

```
encoded = major * MajorScale + minor * MinorScale + patch * PatchScale
```

### Constants

```go
const (
    MajorScale int64 = 100 * MinorScale   // 1,000,000,000
    MinorScale int64 = 1_000 * PatchScale  // 10,000,000
    PatchScale int64 = 10_000              // 10,000
)
```

Capacity: up to 99 major, 999 minor, 999 patch versions.

### `Encode(v string) int64`

- Strips `v` prefix, build metadata after `+`, and prerelease
- Pads two-component versions (`0.25` → `0.25.0`)
- Uses `golang.org/x/mod/semver` for validation and canonicalization
- Returns 0 for empty/invalid input

Examples:
- `v0.0.425` → `4,250,000`
- `0.25` → `250,000,000`
- `v0.0.425+v0.0.424-3-g01bbe66c` → `4,250,000`

### Data Flow

1. **Parse time:** Go encodes versions → stores as BIGINT columns on `instance_speedruns`
2. **Admin sets minimums:** Go encodes human-readable strings → stores BIGINT thresholds
3. **Leaderboard query:** SQL filters `>= COALESCE(min, 0)` — pure integer comparison

## Version Formats

| Version | Source | Example | Encoding |
|---------|--------|---------|----------|
| Parser version | `version.GitTag + "+" + version.GitCommit` | `v0.0.425+g01bbe66c` | Strip after `+`, encode `v0.0.425` |
| Addon version | `versions["chronicle_companion"]` from combat log | `0.25` | Treat as `0.25.0` |

## API Endpoints

### Public

- `GET /api/v1/leaderboard/speedrun?instance_name=Molten+Core` — leaderboard with version filtering
- `GET /api/v1/raidlogs/instances/{id}/speedrun` — single instance speedrun result with version status

### Admin (requires `CanAdmin_users_User`)

- `GET /api/v1/admin/leaderboard/version-requirements` — list all configured requirements
- `PUT /api/v1/admin/leaderboard/version-requirements` — upsert requirements for an instance name

The PUT endpoint accepts human-readable version strings; the server encodes them to `_num` integers.

## Version Status on Instance Speedrun

The `GET .../speedrun` endpoint attaches `version_status` by looking up requirements at response time:

```json
{
  "qualified": true,
  "duration_ms": 12345,
  "proof": [...],
  "version_status": {
    "parser_version": "v0.0.425",
    "min_parser_version": "v0.0.400",
    "parser_qualified": true,
    "addon_version": "0.25",
    "min_addon_version": "0.20",
    "addon_qualified": true
  }
}
```

This is computed at **response time** (not stored), so changing admin requirements immediately affects the status. A once-valid run can become invalid.

## Frontend

### Leaderboard Panel (EventsPanel)

Registered as `leaderboard` in the panel system. Uses `useQuery` with `retry: false` and `staleTime: Infinity` to fetch `/api/v1/raidlogs/instances/{id}/speedrun`. No event stream processing — data comes from the API.

Displays:
- Trophy icon + "Speedrun" label
- Duration (if qualified) or "Incomplete (N/M)" count
- Requirements grouped by `category` with ✅/❌ per requirement
- Count shown as `×N` when `requirement.count > 1`
- Version Requirements section (if `version_status` present) with ✅/❌ per version check

### Admin UI

Leaderboard tab on `/admin` page with:
- Table of current version requirements per instance
- Form to add/edit per instance name
- "Set All" button — applies versions to all known instance names, preserving existing values for empty fields

## Key Design Decisions

1. **Separate `instance_speedruns` table** — most instances don't have speedrun data, keeps queries lean
2. **Proof as JSONB** — flexible, avoids schema changes when adding new proof types
3. **Duplicate handling** — `DISTINCT ON (COALESCE(duplicate_group_id, id))` deduplicates within groups
4. **Go-side version encoding, SQL-side filtering** — encoding handles messy version formats cleanly, SQL comparison is trivial `>=`
5. **Version status computed at response time** — admin can change requirements and immediately affect all instances
6. **Speedrun data on separate endpoint** — not part of main instance API, fetched only when needed
7. **`category` on requirements** — groups display (Bosses/Trash) without changing data model
