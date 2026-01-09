-- name: InsertLogFile :one
INSERT INTO
  log_file(
    id,
    owner,
    hash,
    wow_log_id,
    size_bytes,
    mime_type,
    created_at,
    updated_at
  )
VALUES
  (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8
   )
RETURNING *
;

-- name: InsertWoWLogGroup :one
INSERT INTO
  wow_log_groups(
    id,
    owner,
    created_at,
    updated_at
  )
VALUES
  (
    $1,
    $2,
    $3,
    $4
  )
RETURNING *
;

-- name: DeleteWoWLogGroup :exec
DELETE FROM
  wow_log_groups
WHERE
  id = $1
;