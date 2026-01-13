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

-- name: GetWoWLogFilesByGroupID :many
SELECT
  *
FROM
  log_file
WHERE
  wow_log_id = $1
ORDER BY
  created_at DESC
;

-- name: DeleteWoWLogGroup :exec
DELETE FROM
  wow_log_groups
WHERE
  id = $1
;

-- name: GetWoWLogGroupsByOwner :many
SELECT
  sqlc.embed(wow_log_groups),
  COALESCE(
      jsonb_agg(
      jsonb_build_object(
        'id', json_file.id,
        'owner', json_file.owner,
        'wow_log_id', json_file.wow_log_id,
        'hash', json_file.hash,
        'size_bytes', json_file.size_bytes,
        'mime_type', json_file.mime_type,
        'created_at', json_file.created_at,
        'updated_at', json_file.updated_at
      )
      ORDER BY json_file.created_at
               ) FILTER (WHERE json_file.id IS NOT NULL),
      '[]'::jsonb
  )::wow_log_group_files AS files
FROM
  wow_log_groups
LEFT JOIN log_file json_file
    ON json_file.wow_log_id = wow_log_groups.id
WHERE
  wow_log_groups.owner = $1
GROUP BY
  wow_log_groups.id
ORDER BY
  wow_log_groups.created_at DESC
;

-- name: GetWoWLogGroupByID :one
SELECT
  sqlc.embed(wow_log_groups),
  COALESCE(
      jsonb_agg(
      jsonb_build_object(
        'id', json_file.id,
        'owner', json_file.owner,
        'wow_log_id', json_file.wow_log_id,
        'hash', json_file.hash,
        'size_bytes', json_file.size_bytes,
        'mime_type', json_file.mime_type,
        'created_at', json_file.created_at,
        'updated_at', json_file.updated_at
      )
      ORDER BY json_file.created_at
               ) FILTER (WHERE json_file.id IS NOT NULL),
      '[]'::jsonb
  )::wow_log_group_files AS files
FROM
  wow_log_groups
LEFT JOIN log_file json_file
    ON json_file.wow_log_id = wow_log_groups.id
WHERE
  wow_log_groups.id = $1
GROUP BY
  wow_log_groups.id
;