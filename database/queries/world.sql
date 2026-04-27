-- name: GetWorld :one
SELECT * FROM world WHERE id = $1;

-- name: GetWorldByName :one
SELECT * FROM world WHERE name = $1;

-- name: ListWorlds :many
SELECT * FROM world ORDER BY name;

-- name: InsertWorld :one
INSERT INTO world (name)
VALUES ($1)
RETURNING *;

-- name: DeleteWorld :exec
DELETE FROM world WHERE id = $1;

-- name: AssignWorldToServer :exec
INSERT INTO world_server (server_id, world_id)
VALUES ($1, $2)
ON CONFLICT DO NOTHING;

-- name: UnassignWorldFromServer :exec
DELETE FROM world_server
WHERE server_id = $1 AND world_id = $2;

-- name: GetWorldsByServer :many
SELECT w.*
FROM world w
JOIN world_server ws ON w.id = ws.world_id
WHERE ws.server_id = $1
ORDER BY w.name;

-- name: GetServersForWorld :many
SELECT s.*
FROM wow_servers s
JOIN world_server ws ON s.id = ws.server_id
WHERE ws.world_id = $1
ORDER BY s.name;
