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
  log_instances (id, realm_id, log_group_id, name)
VALUES
  ($1, $2, $3, $4)
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
  log_instances
WHERE
  id = $1
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
  log_instance_players (instance_id, unit_guid, name, level, class, race)
VALUES
  ($1, $2, $3, $4, $5, $6)
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