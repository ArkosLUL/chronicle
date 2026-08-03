# Fill the `default` dataset with the missing spell/talent game data

## Context

The Datasets card at `/game-data/datasets` shows the `default` dataset
(`00000000-0000-0000-0000-000000000001`, 3.3.5a build 12340, wrath/azerothcore) with only
6 of 22 categories populated:

- **Present:** Creatures (30,188), Items (46,100), Item Display Info (57,986),
  Enchantments (2,656), Random Properties (2,012), Item Sets (1,245)
- **Missing:** Spells, Talents, Cast Times, Durations, Ranges, Icons, Categories, Radii,
  Focus Objects, Affected Durations, Consumables, Extra Attacks, Duration Mods,
  Periodic Spells, Cooldowns, Desc Variables

**Nothing is missing from the code.** All 14 importers are registered
(`scripts/dbcdata/cli/importer.go:72-89`) and all 13 `dbc_type` handlers are wired
(`api/gamedataapi/upload_dbc.go:134-165`). The gap is purely operational: the six present
categories came from `chronicle import-world` (which imports 4 DBCs directly into Postgres,
`cmd/chronicle/cli/importworld.go:402`) plus world-table JSON. `dbcdata import` — the path
that uploads Spell.dbc and its 9 companion DBCs — was never run against this local dataset.

The 6 remaining "missing" rows (Extra Attacks, Duration Mods, Periodic Spells, Cooldowns,
Affected Durations, Consumables) are **derived server-side**, not imported. They populate
automatically inside the Spell / SpellDuration / Item upload handlers
(`upload_spell_derived.go:14`, `derive_aura_durations.go:19`, `derive_consumables.go:15`).

**Outcome:** run `dbcdata import` once against the local server, delivered as a committed,
repeatable script; every row on the card turns green.

## Environment (verified)

| Thing | Value |
|---|---|
| Chronicle app | `chronicle-app-1`, `localhost:4000`, network `chronicle_default`, service alias `app` |
| Postgres | `chronicle-postgres-1`, host port 5433 |
| WoW client | `A:\WOW\world of warcraft 3.3.5a hd` (has `Data/{dede,enus,eses,frfr,ruru}`) |
| Go toolchain on host | **absent** — `go: command not found`, so everything runs in a container |
| BrowserOnly middleware | no-op here: `CHRONICLE_ACCESS_URL=http://localhost:4000` sets `isDev` (`api/httpmw/browseronly.go:14`) |

Two known traps, both already solved by the sibling script `scripts/import_azerothcore_world.sh`:

1. **Locale bleed.** `content.Open` walks every `.mpq` under the client dir with no locale
   parameter; `ruru`/`frfr` sort after `enus`, so `DBFilesClient\*.dbc` resolves to the
   Russian/French archives and you get localized names. Fix: mask the four non-enUS locale
   dirs with empty tmpfs mounts. Do **not** flatten into a symlink farm — version detection
   falls back to bruteforce and panics on `patch-2.mpq`.
2. **`MSYS_NO_PATHCONV=1`** — Git Bash rewrites container-side absolute paths without it.

## Step 1 — Add `scripts/import_azerothcore_dbc.sh`

New file, modelled directly on `scripts/import_azerothcore_world.sh` (same image, same
mounts, same tmpfs masking, same module-cache volume). Differences: it runs
`./scripts/dbcdata import` instead of `./cmd/chronicle import-world`, joins the compose
network to reach the API rather than the DB, and takes auth from the environment.

```bash
#!/usr/bin/env bash
# Upload DBC game data into a Chronicle dataset from the local WoW client.
#
# Runs in a throwaway Go container because there is no Go toolchain on the host,
# and because the client's DBCs have to be read through an enUS-only view: the
# client has deDE/enUS/esES/frFR/ruRU installed, content.Open walks every .mpq
# with no locale parameter, and ruru/frfr sort after enus. Masking the other
# locale dirs with empty tmpfs mounts leaves enus as the only locale in the pool
# while keeping WoW.exe and the rest of the layout intact, which version
# detection needs.
#
# Auth: export CHRONICLE_COOKIE with the chronicle_auth_session cookie from a
# logged-in admin browser session; the CLI trades it for a JWT via /whoami/dump.
# CHRONICLE_TOKEN works too if you already have a bearer token.
#
# Usage: scripts/import_azerothcore_dbc.sh [extra dbcdata import flags...]
set -euo pipefail

REPO_DIR="${REPO_DIR:-g:/DevStuff/GitHub/Chronicle/chronicle}"
CLIENT_DIR="${CLIENT_DIR:-A:/WOW/world of warcraft 3.3.5a hd}"
GO_IMAGE="${GO_IMAGE:-golang:1.25.7-alpine3.22}"
NETWORK="${CHRONICLE_NETWORK:-chronicle_default}"
API_URL="${API_URL:-http://app:4000}"
DATASET_ID="${DATASET_ID:-00000000-0000-0000-0000-000000000001}"
IMPORTS="${IMPORTS:-all}"

if [ -z "${CHRONICLE_TOKEN:-}" ] && [ -z "${CHRONICLE_COOKIE:-}" ]; then
  echo "Set CHRONICLE_COOKIE (chronicle_auth_session value) or CHRONICLE_TOKEN." >&2
  exit 1
fi

export MSYS_NO_PATHCONV=1

docker run --rm -it \
    -v "${REPO_DIR}:/src" \
    -v "${CLIENT_DIR}:/wow:ro" \
    -v chronicle-gomod:/go/pkg/mod \
    --tmpfs /wow/Data/dede \
    --tmpfs /wow/Data/eses \
    --tmpfs /wow/Data/frfr \
    --tmpfs /wow/Data/ruru \
    --network "$NETWORK" \
    -e WOW_CLIENT_PATH=/wow \
    -e CHRONICLE_TOKEN="${CHRONICLE_TOKEN:-}" \
    -e CHRONICLE_COOKIE="${CHRONICLE_COOKIE:-}" \
    -w /src \
    "$GO_IMAGE" \
    go run ./scripts/dbcdata import \
    --server=azerothcore \
    --api-url="$API_URL" \
    --dataset-id="$DATASET_ID" \
    --import="$IMPORTS" \
    --mode=upsert \
    --yes \
    "$@"
```

Notes on the flag choices:

- **No `--tags azerothcore`.** The AzerothCore extended Spell layout
  (`dbcdb/spell_layout_azerothcore.go`) only matters for locally-parsed DBCs; the `spells`
  importer is a raw passthrough and the *server* picks the layout, trying build 12340 then
  12341 and validating that spell 139 parses as "Renew" (`upload_dbc.go:91-122`). Upstream's
  own `scripts/upload-dbc/legacy.sh` runs the azerothcore target without the tag.
- **`--import=all`** re-upserts the four already-present DBC categories. Harmless — every
  handler upserts on `ON CONFLICT (dataset_id, id)`.
- **`--yes`** requires `--dataset-id` and skips the interactive TUI/tenant guard, which is
  what we want for a scripted run into a known local dataset.

## Step 2 — Run it

```bash
# In devtools on http://localhost:4000, copy the chronicle_auth_session cookie value.
export CHRONICLE_COOKIE='<chronicle_auth_session value>'
scripts/import_azerothcore_dbc.sh
```

The account behind that cookie must pass `CanAdmin_world_data_User`
(`api/gamedataapi/handler.go:58-75`).

Expect 14 sequential uploads. Spell.dbc is the big one (well under the 50 MB cap at
`upload_dbc.go:23`); it triggers the derivations for extra attacks, duration modifiers,
periodic spells, cooldowns, affected aura durations and consumables.

## Verification

1. **Card:** reload `/game-data/datasets`. All 22 rows should show `✓`. The summary is a
   live 22×`COUNT(*)` query with a 30s React-Query `staleTime`, so hard-refresh if stale.
2. **API directly:**
   ```bash
   curl -s -H "Authorization: Bearer $TOKEN" \
     http://localhost:4000/api/v1/admin/datasets/00000000-0000-0000-0000-000000000001/import-summary
   ```
3. **DB spot-check** (`psql postgres://postgres:postgres@localhost:5433/chronicle`):
   ```sql
   SELECT count(*) FROM dbc_spells WHERE dataset_id = '00000000-0000-0000-0000-000000000001';
   SELECT name FROM dbc_spells WHERE dataset_id = '00000000-0000-0000-0000-000000000001' AND spell_id = 139;
   ```
   Spell 139 must be `Renew`. Also eyeball a few `dbc_spell_icons` / `dbc_item_set` names for
   Cyrillic or French text — that would mean the tmpfs locale masking didn't take.
4. **Derived-table fallback.** If any of Extra Attacks / Duration Mods / Periodic Spells /
   Cooldowns / Affected Durations / Consumables still reads 0 while Spells is non-zero, the
   derivation ran before its inputs landed. Re-run the spell upload last, which re-derives
   everything:
   ```bash
   IMPORTS=spells scripts/import_azerothcore_dbc.sh
   ```
5. **UI smoke test:** open a talent-tree view and a spell tooltip and confirm names, icons,
   cast times and durations render instead of the empty state.

## Out of scope (noted, not fixed)

`frontend/.../GameData/DBCTab.tsx:16-40` still lists only 4 `SUPPORTED_DBCS` while the server
dispatches 13, so the admin upload UI can't reach the spell DBCs by hand. Irrelevant to this
CLI-driven import; worth a separate change if manual uploads are wanted.
