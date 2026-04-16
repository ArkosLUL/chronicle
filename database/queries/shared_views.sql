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

-- name: GetSharedViewByInstanceAndHash :one
SELECT *
FROM shared_views
WHERE instance_id = $1 AND hash = $2;
