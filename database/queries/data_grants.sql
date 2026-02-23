-- name: GetUserDataGrants :many
SELECT * FROM data_grants
WHERE user_id = $1
  AND (expires_at IS NULL OR expires_at > NOW())
ORDER BY created_at ASC;

-- name: UpsertDataGrant :one
INSERT INTO data_grants (user_id, source, storage_bytes, description, expires_at)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (user_id, source) DO UPDATE SET
  storage_bytes = EXCLUDED.storage_bytes,
  description = EXCLUDED.description,
  expires_at = EXCLUDED.expires_at
RETURNING *;

-- name: DeleteDataGrant :exec
DELETE FROM data_grants
WHERE user_id = $1 AND source = $2;
