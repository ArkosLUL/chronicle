-- name: InsertFile :one
INSERT INTO
  files(
    id,
    owner,
    hash,
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
    $7
   )
RETURNING *
;

-- name: InsertWowLog :one
INSERT INTO
  wow_logs(
    id,
    owner,
    first_log_file,
    second_log_file,
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
    $6
  )
RETURNING *
;