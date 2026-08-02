# Integrating mod-chronicle with the Chronicle app on AzerothCore

## Context

Goal: dungeon/raid combat logs generated server-side by `mod-chronicle` on the AzerothCore
worldserver should upload automatically to the self-hosted Chronicle app and be parsed into
usable reports, with no client addon and no manual file handling.

Both halves are installed and the transport already works — the worldserver log shows
`Chronicle: ping OK (HTTP 200)`. The pipeline still produces nothing useful because the
Chronicle app container was compiled for the **wrong game version**, and no run has yet been
flushed end to end.

Repos:
- AzerothCore + module: `g:/DevStuff/GitHub/azerothcore-wotlk-pb` (module at `modules/mod-chronicle`)
- Chronicle app: `g:/DevStuff/GitHub/Chronicle/chronicle`

## Verified current state

Running containers: `ac-worldserver`, `ac-authserver`, `ac-database` (mysql), `chronicle-app-1`,
`chronicle-postgres-1`, `chronicle-spicedb-1`, `chronicle-ocr-server-1`.

**Already done — do not redo:**
- `mod-chronicle` is compiled into the locally-built `acore/ac-wotlk-worldserver:master` image.
  The core carries the 18 custom hooks the module needs (verified against `src/server/game/Scripting/ScriptDefines/`).
- Module config is live via `configurationOverrides/Chronicle.env`
  (`AC_CHRONICLE_ENABLE`, `AC_CHRONICLE_UPLOAD_URL=http://host.docker.internal:4000`,
  `AC_CHRONICLE_UPLOAD_SECRET=76b2e6…8046c`). `env/dist/etc/modules/mod_chronicle.conf` holds the
  same values; the env vars win.
- `Chronicle: ping OK (HTTP 200)` at worldserver startup → the bearer secret resolves to a valid
  upload key with SpiceDB `upload_log` permission on a realm. Auth is correct.
- Chronicle DB has server `Azerothcore` → realm `AzerothCore` → upload key `Test key`, plus a
  dataset row `Azerothcore` (slug `ac-wow`, 3.3.5a, flavor `{wrath,azerothcore}`).
- No SQL install step exists or is needed for the module — it touches no AzerothCore database.

**Blockers found:**

1. **The Chronicle app is a `turtle` (WoW 1.12) build.** `chronicle-app-1` logs emit
   `"server":"turtle"`. `SERVER` is a compile-time build tag, and it decides:
   - `services.ServerBuild` = 1.12 (`internal/services/serveridentity_turtle.go`), used by
     `gamedb.New` at [wowdb.go:101](database/gamedb/wowdb.go#L101) to pick the DBC layout;
   - the Spell.dbc default path `./assets/turtle/Spell.dbc`
     ([servicewowdb.go:335](internal/services/servicewowdb/servicewowdb.go#L335)) — so **every**
     3.3.5a spell ID resolves against 1.12 data regardless of dataset;
   - `ensureDefaultDataset` ([servicedataset.go:131](internal/services/servicedataset/servicedataset.go#L131)),
     which is why dataset `00000000-…-0001` currently reads `1.12.2 / {vanilla,nightmare-of-ursol,turtle}`.
2. **The `Azerothcore` server row has `default_dataset_id = NULL`**, so
   `ResolveDatasetForRealm` falls back to that default dataset. Proof it already bit: the two
   existing `wow_log_groups` rows have `format = azerothcore-mod` but `flavor =
   {vanilla,nightmare-of-ursol,turtle}`. Without `azerothcore` in the flavor set, the
   AzerothCore instance/boss hooks at
   [hookable.go:129](combatlog/parser/common/instances/hookable.go#L129) never engage.
3. **No mod-chronicle upload has ever landed** — `server_upload_meta` is empty and
   `env/dist/logs/chronicle_logs/` is empty. The two existing log groups came in through the
   browser upload path (`log_type = v2`), not the server path.
4. **Uploads only fire on instance destroy** with the current config, so nothing flushes during
   normal play.

## Phase 1 — Rebuild Chronicle as an AzerothCore build, fresh DB

Working dir: `g:/DevStuff/GitHub/Chronicle/chronicle`.

1. `.env` — change `SERVER=turtle` to `SERVER=azerothcore`. **Leave `POSTGRES_DB=chronicle`**;
   compose passes it explicitly, and the `DB_NAME` switch in `Makefile:28` only affects the
   non-Docker `make create-db` path.
2. `compose.yml` — the `app.environment` block is an explicit allowlist, so anything not listed
   never reaches the container. Add under `app.environment`:
   ```yaml
   CHRONICLE_LOG_PARSING_WORKERS: ${CHRONICLE_LOG_PARSING_WORKERS:-4}
   CHRONICLE_CLIENT_UPLOADS_DISABLED: ${CHRONICLE_CLIENT_UPLOADS_DISABLED:-true}
   CHRONICLE_EMIT_PARSE_LOGS: ${CHRONICLE_EMIT_PARSE_LOGS:-false}
   ```
   Parse workers default to 1. Disabling client uploads is what
   [api.go:68](api/api.go#L68) describes as the intended setting "for servers using server-side
   logging" — it stops browser uploads mixing formats into the same realm.
3. **Destructive — confirm before running.** Wipe and rebuild:
   ```
   docker compose -f compose.yml down -v --remove-orphans
   docker compose -f compose.yml up --build -d
   ```
   `-v` drops `chronicle-postgres-data` (Chronicle **and** SpiceDB data) and `chronicle-storage`
   (uploaded log blobs). `spicedb-migrate` re-runs automatically; Chronicle's own migrations run
   at startup.

Expected in `docker logs chronicle-app-1`: `"server":"azerothcore"`, `wow_version 3.3.5a`,
`build_version 12340`, `default_flavor [wrath azerothcore]`, and a `WoWDB service started` line
with a non-zero `spell_count`.

Note: `frontend/imagecache/azerothcore/` does not exist, but nothing in the build needs it —
`frontend/chronicle/src/constants/dbmem/azerothcore/` and
`spellTestVectors.azerothcore.generated.ts` both exist, and runtime icons come from the
dataset's `icon_base_url`.

## Phase 2 — Re-provision server, realm, upload key, dataset

The wipe removes the user, server, realm, key and both dataset rows.

1. Sign up at `http://localhost:4000` with email + password. **The first account to sign up
   becomes `technical_admin`** ([methods.go:371](database/authz/methods.go#L371)) — do this before
   anyone else registers.
2. Go to `/servers` and create: server (e.g. `Azerothcore`) → realm. The realm **name must match
   the realm name AzerothCore reports** — mod-chronicle sends it as `X-Chronicle-Realm-Name` and
   embeds it in the `CHRONICLE_HEADER` line, which is what
   [logparse_realm.go:142](chronicle/logparse_realm.go#L142) scans for.
3. On the same page, set the server's **Dataset** to the AzerothCore dataset via the
   `ServerDatasetSelect` control ([ServersPage.tsx:463](frontend/chronicle/src/pages/Servers/ServersPage.tsx#L463)).
   After Phase 1 the compiled-in default dataset is already 3.3.5a/`{wrath,azerothcore}`, so this
   is belt-and-braces — but it is what keeps resolution correct if another dataset is added later.
4. Create an upload key on the realm. **The raw token is shown once** — copy it.
5. Put that token in **both** places so they can't drift:
   - `g:/DevStuff/GitHub/azerothcore-wotlk-pb/configurationOverrides/Chronicle.env` →
     `AC_CHRONICLE_UPLOAD_SECRET` (this is the one that actually takes effect)
   - `g:/DevStuff/GitHub/azerothcore-wotlk-pb/env/dist/etc/modules/mod_chronicle.conf` →
     `Chronicle.UploadSecret`

## Phase 3 — mod-chronicle flush policy

Default config only uploads when an instance is destroyed or the worldserver shuts down (which
flushes all writers and waits up to 45 s). Enable idle rotation so segments land during play.

In `configurationOverrides/Chronicle.env`, add:
```
      AC_CHRONICLE_IDLE_CLOSE_SECONDS: "300"
      AC_CHRONICLE_ROTATE_ON_IDLE: "1"
```
Mirror into `env/dist/etc/modules/mod_chronicle.conf` (`Chronicle.IdleCloseSeconds = 300`,
`Chronicle.RotateOnIdle = 1`) to keep the two consistent.

Why this is safe: each rotated segment is uploaded with the same 128-bit
`X-Chronicle-Instance-Token`, and `FindMatchingServerUpload` →
[chronicle.go:468 `AppendServerLog`](chronicle/chronicle.go#L468) concatenates gzip members into
one multistream log group and re-parses. One logical run stays one report. Do **not** enable
`UploadSnapshots` — snapshots deliberately overlap the final log and duplicate data.

Idle is evaluated lazily on the next write, so a truly dead instance flushes when it is destroyed
rather than exactly at 300 s.

Apply with `docker compose up -d --force-recreate ac-worldserver` (worldserver only; no image
rebuild needed since these are env vars).

## Phase 4 — End-to-end verification

1. Worldserver startup log shows `Chronicle: ping OK (HTTP 200)` against the new secret.
   A failure prints `Chronicle: ping failed (HTTP n)`; 401 = wrong/unknown token, 403 = key
   lacks realm permission.
2. Run a dungeon or raid, kill at least one boss, then leave and let the instance unload (or wait
   out the idle window).
3. Files appear then vanish from
   `g:/DevStuff/GitHub/azerothcore-wotlk-pb/env/dist/logs/chronicle_logs/` — pattern
   `instance_<mapId>_<instanceId>_<epoch>.log`. **The module deletes the file only on HTTP 201.**
   A file that lingers means the upload was rejected; the worldserver log carries the status code.
4. Server side:
   ```
   docker exec chronicle-postgres-1 psql -U postgres -d chronicle \
     -c "select log_type, format, flavor, created_at from wow_log_groups order by created_at desc;" \
     -c "select instance_id, instance_name, instance_token from server_upload_meta;" \
     -c "select last_used_at from wow_server_upload_keys;"
   ```
   Expect `log_type = azerothcore`, `format = azerothcore-mod`, `flavor = {wrath,azerothcore}`,
   a populated `server_upload_meta` row, and a non-null `last_used_at`.
   **`flavor` containing `turtle` or `vanilla` means Phase 1 or 2 did not take.**
5. Open the log in the UI and confirm the encounter is split into boss pulls, players are named
   with gear and talents, and spell names/icons resolve. Job state is inspectable at
   `http://localhost:4000/river`; set `CHRONICLE_EMIT_PARSE_LOGS=true` for verbose parser output
   when something looks wrong.
6. Re-enter the same instance and force a second segment — confirm it appends to the existing log
   group rather than creating a second one.

## Phase 5 — World data import (boss, creature and item names)

Optional for parsing to work; it improves creature/item resolution. Run after Phase 4 passes so
a failure here is unambiguous.

The importer is `chronicle import-world --server=azerothcore`
([importworld_azerothcore.go](cmd/chronicle/cli/importworld_azerothcore.go)). Two things about
it to know up front:

- **The `chronicle` CLI is not in the Docker image** — `services/chronicled/Dockerfile:51` ships
  only `chronicled`. Run it from the host with Go
  (`go run --tags azerothcore ./cmd/chronicle import-world …`).
- **Postgres is not published to the host** (`chronicle-postgres-1` exposes `5432/tcp` with no
  host mapping). Either add a `ports: ["5433:5432"]` mapping to the `postgres` service in
  `compose.yml`, or run the CLI inside the compose network.

### 5a. Export tables from `ac-database` to JSON

Only these eight tables have schemas
([importworld_turtle.go:42](cmd/chronicle/cli/importworld_turtle.go#L42) — the map is shared
across servers):

`world_display_info`, `world_creature_template`, `world_item_enchantment`,
`world_item_template`, `world_spell_area`, `world_spell_chain`, `world_spell_group`,
`world_spell_threat`

Highest value for raid logs: `world_creature_template` (boss/mob names) and `world_item_template`
(gear names in `CHRONICLE_COMBATANT_INFO`).

Write each as a JSON array of objects into `importdata/world/azerothcore/`, **naming the file
after the target table** (`world_creature_template.json`). `detectFiles` short-circuits on a
filename that matches a schema key, skipping key fingerprinting.

JSON keys must equal the schema column names — `importTable` looks up `row[column]` directly and
silently substitutes `0`/`""` for anything missing, so a mis-mapped column is a quiet data loss,
not an error. AzerothCore's `acore_world.creature_template` uses different names from the schema
(`modelid1` → `display_id1`, `minlevel` → `level_min`, and there is no health column at all —
3.3.5a keeps it in `creature_classlevelstats`). Export with an explicit
`SELECT … AS <schema_column>` per column rather than dumping raw. `scripts/convert_cmangos_sql_to_json.py`
handles the cmangos/wotlk-db item dump if you prefer that as the item source.

### 5b. Patch the hardcoded client path before running

[serverconfig.go:23-24](scripts/dbcdata/cli/serverconfig.go#L23) returns
`/home/steven/Games/Warmane` for `azerothcore` — the upstream author's machine.
`importWorldAzerothcore` only skips the DBC step when that string is empty, so on Windows it
takes the non-empty branch, fails to open the path, and **aborts the whole import after the JSON
tables have already been written**. Before running, change that case to either your local 3.3.5a
client directory or `""`.

### 5c. Run

```
go run --tags azerothcore ./cmd/chronicle import-world \
  --server=azerothcore \
  --db-url="postgres://postgres:postgres@127.0.0.1:5433/chronicle?sslmode=disable" \
  --dataset-id=<azerothcore dataset uuid>
```
Omit `--dataset-id` for an interactive picker. Use `--dry-run` first to confirm file→table
detection. `--truncate` clears world and DBC tables before importing.

Verify: creature and boss names render in a report that previously showed bare entry IDs, and
`select count(*) from world_creature_template where dataset_id = '<uuid>';` is non-zero.

## Files touched

| File | Change |
|---|---|
| `chronicle/.env` | `SERVER=azerothcore` |
| `chronicle/compose.yml` | 3 env vars added to `app.environment`; optional `postgres` port mapping for Phase 5 |
| `azerothcore-wotlk-pb/configurationOverrides/Chronicle.env` | new upload secret; idle-rotation vars |
| `azerothcore-wotlk-pb/env/dist/etc/modules/mod_chronicle.conf` | mirror of the above |
| `chronicle/scripts/dbcdata/cli/serverconfig.go` | Phase 5 only — fix the hardcoded `azerothcore` client path |
| `chronicle/importdata/world/azerothcore/*.json` | Phase 5 only — new export files |

## Gotchas

- The upload secret lives in two places. `AC_CHRONICLE_UPLOAD_SECRET` (env) beats
  `Chronicle.UploadSecret` (conf) — the worldserver log confirms this with
  `Found config value 'Chronicle.UploadURL' from environment variable 'AC_CHRONICLE_UPLOAD_URL'`.
  Keep both in sync so a future env-file removal doesn't silently fall back to a stale token.
- `Chronicle.VerifyTLS has no effect unless UploadURL uses https://` is benign for a
  `host.docker.internal` HTTP setup.
- Battlegrounds, arenas and open world are never logged. With `TrackDungeonRuns = 1`, all
  dungeons and raids are.
- On worldserver crash, orphaned `.log` files are swept and uploaded at next startup — but with
  `instanceId=0` and no realm/token headers, so they cannot be correlated into a run. Prefer a
  clean `.server shutdown`, which flushes all writers properly.
- Chronicle phones home to `telemetry.chronicleclassic.com` every 6 h with a deployment UUID,
  version, your `CHRONICLE_ACCESS_URL` and aggregate counts. No documented off-switch.
