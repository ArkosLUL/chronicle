-- name: CreateRaidComposition :one
INSERT INTO raid_compositions (id, user_id, tenant_id, guild_id, name, data, public_view)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: ListRaidCompositionsByUser :many
SELECT *
FROM raid_compositions
WHERE user_id = $1 AND tenant_id = $2
ORDER BY updated_at DESC;

-- name: GetRaidCompositionByID :one
SELECT *
FROM raid_compositions
WHERE id = $1;

-- Ownership is NOT filtered here: SpiceDB gates edit access so granted
-- editors can update too. Handlers must check the edit permission first.
-- name: UpdateRaidCompositionByID :one
UPDATE raid_compositions
SET
  name = COALESCE(sqlc.narg(name), name),
  guild_id = COALESCE(sqlc.narg(guild_id), guild_id),
  data = COALESCE(sqlc.narg(data), data),
  updated_at = now()
WHERE id = sqlc.arg(id)
RETURNING *;

-- name: UpdateRaidCompositionSharing :one
UPDATE raid_compositions
SET public_view = $2, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeleteRaidCompositionByID :execrows
DELETE FROM raid_compositions
WHERE id = $1;

-- name: CountRaidCompositionsByUser :one
SELECT COUNT(*)
FROM raid_compositions
WHERE user_id = $1 AND tenant_id = $2;
