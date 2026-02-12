-- name: DeleteAllParsedLogsByGroupID :exec
DELETE FROM
  parsed_log_group
WHERE
  id = $1
;

-- name: InsertParsedLogGroup :exec
INSERT INTO
  parsed_log_group (id)
VALUES
  ($1)
;

-- name: InsertInstance :one
INSERT INTO
  log_instances (id, realm_id, log_group_id, name, hashed_slug, guild_id)
VALUES
  ($1, $2, $3, $4, $5, $6)
RETURNING *
;

-- name: InsertEncounter :one
INSERT INTO
  log_instance_encounters (id, instance_id, name, kill, remaining, boss, start_time, end_time)
VALUES
  ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *
;

-- name: Instance :one
SELECT
  *
FROM
  log_instances_guild
WHERE
  log_instances_guild.id = $1
;

-- name: InstanceBySlug :one
SELECT
  *
FROM
  log_instances_guild
WHERE
  hashed_slug = $1 AND hashed_slug != ''
;

-- name: EncountersByInstanceID :many
SELECT
  *
FROM
  log_instance_encounters
WHERE
  instance_id = $1
;

-- name: InsertInstanceUnits :batchexec
INSERT INTO
  log_instance_units (instance_id, unit_guid, name, entry, owner_guid)
VALUES
  ($1, $2, $3, $4, $5)
;

-- name: InsertInstancePlayers :batchexec
INSERT INTO
  log_instance_players (instance_id, unit_guid, name, level, class, race, guild_id)
VALUES
  ($1, $2, $3, $4, $5, $6, $7)
;

-- name: InsertEncounterCharacterFights :batchexec
INSERT INTO
  log_instance_encounter_hostiles (id, boss, encounter_id, periods)
VALUES
  ($1, $2, $3, $4)
;

-- name: GetInstanceEncounterCharacterFights :many
SELECT
  *
FROM
  log_instance_encounter_hostiles
WHERE
  encounter_id IN (SELECT id FROM log_instance_encounters WHERE instance_id = $1)
;

-- name: InstanceUnitsByInstanceID :many
SELECT
  *
FROM
  log_instance_units
WHERE
  instance_id = $1
;

-- name: InstancePlayersByInstanceID :many
SELECT
  *
FROM
  log_instance_players
WHERE
  instance_id = $1
;

-- name: ListRecentInstances :many
SELECT 
    li.id,
    li.hashed_slug as slug,
    li.name,
    li.realm_id,
    wsr.name as realm_name,
    wlg.owner as uploader_id,
    u.username as uploader_name,
    wlg.created_at as uploaded_at,
    (SELECT COUNT(*) FROM log_instance_players lip WHERE lip.instance_id = li.id) as player_count,
    (SELECT COUNT(*) FROM log_instance_encounters lie WHERE lie.instance_id = li.id AND lie.boss = true) as boss_count,
    (SELECT COUNT(*) FROM log_instance_encounters lie WHERE lie.instance_id = li.id AND lie.boss = true AND lie.kill = true) as boss_kills,
    (SELECT EXTRACT(EPOCH FROM (MAX(lie.end_time) - MIN(lie.start_time))) * 1000 
     FROM log_instance_encounters lie WHERE lie.instance_id = li.id)::float8 as duration_ms
FROM log_instances li
JOIN parsed_log_group plg ON plg.id = li.log_group_id
JOIN wow_log_groups wlg ON wlg.id = plg.id
JOIN users u ON u.id = wlg.owner
JOIN wow_server_realms wsr ON wsr.id = li.realm_id
WHERE true
    -- Filter by instance name
    AND CASE
        WHEN @instance_name :: text != '' THEN
            li.name = @instance_name
        ELSE true
    END
    -- Filter by realm
    AND CASE
        WHEN @realm_id :: uuid != '00000000-0000-0000-0000-000000000000'::uuid THEN
            li.realm_id = @realm_id
        ELSE true
    END
    -- Cursor pagination (uploaded_at, id) - pass '0001-01-01' to skip
    AND CASE
        WHEN @cursor_time :: timestamptz != '0001-01-01'::timestamptz THEN
            (wlg.created_at < @cursor_time 
             OR (wlg.created_at = @cursor_time AND li.id < @cursor_id :: uuid))
        ELSE true
    END
ORDER BY wlg.created_at DESC, li.id DESC
LIMIT @limit_count;

-- name: ListRecentInstancesByPlayer :many
SELECT DISTINCT ON (wlg.created_at, li.id)
    li.id,
    li.hashed_slug as slug,
    li.name,
    li.realm_id,
    wsr.name as realm_name,
    wlg.owner as uploader_id,
    u.username as uploader_name,
    wlg.created_at as uploaded_at,
    (SELECT COUNT(*) FROM log_instance_players lip2 WHERE lip2.instance_id = li.id) as player_count,
    (SELECT COUNT(*) FROM log_instance_encounters lie WHERE lie.instance_id = li.id AND lie.boss = true) as boss_count,
    (SELECT COUNT(*) FROM log_instance_encounters lie WHERE lie.instance_id = li.id AND lie.boss = true AND lie.kill = true) as boss_kills,
    (SELECT EXTRACT(EPOCH FROM (MAX(lie.end_time) - MIN(lie.start_time))) * 1000 
     FROM log_instance_encounters lie WHERE lie.instance_id = li.id)::float8 as duration_ms
FROM log_instances li
JOIN log_instance_players lip ON lip.instance_id = li.id
JOIN parsed_log_group plg ON plg.id = li.log_group_id
JOIN wow_log_groups wlg ON wlg.id = plg.id
JOIN users u ON u.id = wlg.owner
JOIN wow_server_realms wsr ON wsr.id = li.realm_id
WHERE lip.name ILIKE @player_name
    -- Filter by instance name
    AND CASE
        WHEN @instance_name :: text != '' THEN
            li.name = @instance_name
        ELSE true
    END
    -- Filter by realm
    AND CASE
        WHEN @realm_id :: uuid != '00000000-0000-0000-0000-000000000000'::uuid THEN
            li.realm_id = @realm_id
        ELSE true
    END
    -- Cursor pagination
    AND CASE
        WHEN @cursor_time :: timestamptz != '0001-01-01'::timestamptz THEN
            (wlg.created_at < @cursor_time 
             OR (wlg.created_at = @cursor_time AND li.id < @cursor_id :: uuid))
        ELSE true
    END
ORDER BY wlg.created_at DESC, li.id DESC
LIMIT @limit_count;

-- name: GetEncounterSummariesByInstanceID :many
SELECT
    lie.id,
    lie.name,
    lie.boss,
    lie.kill
FROM log_instance_encounters lie
WHERE lie.instance_id = $1
ORDER BY lie.start_time ASC;
