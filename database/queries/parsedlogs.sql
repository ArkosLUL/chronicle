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
  log_encounters (id, instance_id, name, kill, start_time, end_time)
VALUES
  ($1, $2, $3, $4, $5, $6)
RETURNING *
;