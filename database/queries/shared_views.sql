-- name: CreateSharedView :one
INSERT INTO shared_views (
  code,
  hash,
  instance_id,
  instance_slug,
  payload,
  created_by
)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetSharedViewByCode :one
SELECT *
FROM shared_views
WHERE code = $1;

-- name: ReattachSharedViewsBySlug :exec
UPDATE shared_views
SET instance_id = $1
WHERE instance_slug = $2 AND instance_id IS NULL;

-- name: GetSharedViewByInstanceAndHash :one
SELECT *
FROM shared_views
WHERE instance_id = $1 AND hash = $2;
