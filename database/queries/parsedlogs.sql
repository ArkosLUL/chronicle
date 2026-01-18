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
  log_encounters (id, instance_id, name, kill, boss, start_time, end_time)
VALUES
  ($1, $2, $3, $4, $5, $6, $7)
RETURNING *
;

-- name: InsertEncounterDamageSummary :one
INSERT INTO
  encounter_damage_unit_summary(
    encounter_id,
    unit_guid,
    damage_done_total,
    damage_taken_total,
    damage_done_abilities,
    damage_taken_abilities,
    is_player,
    owner_guid
  )
VALUES
  ($1, $2, $3, $4, $5, $6, $7, sqlc.narg('owner_guid')::wow_guid)
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
  log_encounters
WHERE
  instance_id = $1
;

-- name: DamageSummariesByInstanceID :many
SELECT
  *
FROM
  encounter_damage_unit_summary
WHERE
  encounter_id IN (SELECT encounter_id FROM log_instances WHERE id = @log_instance_id)
;

-- name: InsertInstanceUnits :batchexec
INSERT INTO
  instance_units (instance_id, unit_guid, is_player, entry, owner_guid)
VALUES
  ($1, $2, $3, $4, $5)
;