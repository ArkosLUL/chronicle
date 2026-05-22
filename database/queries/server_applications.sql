-- Server Applications

-- name: InsertServerApplication :one
INSERT INTO server_applications (id, initiated_by, name, tenant_id)
VALUES (@id, @initiated_by, @name, @tenant_id)
RETURNING *;

-- name: GetServerApplicationByID :one
SELECT sa.*, u.username
FROM server_applications sa
JOIN users u ON u.id = sa.initiated_by
WHERE sa.id = @id;

-- name: GetServerApplicationByInitiatedBy :one
SELECT sa.*, u.username
FROM server_applications sa
JOIN users u ON u.id = sa.initiated_by
WHERE sa.initiated_by = @initiated_by
ORDER BY sa.created_at DESC
LIMIT 1;

-- name: UpdateServerApplicationFieldReviews :exec
UPDATE server_applications SET
    field_reviews = @field_reviews,
    updated_at = now()
WHERE id = @id;

-- name: UpdateServerApplicationStatus :exec
UPDATE server_applications SET
    status = @status,
    admin_note = sqlc.narg('admin_note'),
    reviewed_by = sqlc.narg('reviewed_by'),
    updated_at = now()
WHERE id = @id;

-- name: ListServerApplications :many
SELECT sa.*, u.username
FROM server_applications sa
JOIN users u ON u.id = sa.initiated_by
WHERE (sqlc.narg('status')::text IS NULL OR sa.status = sqlc.narg('status'))
ORDER BY sa.created_at DESC;

-- Server Application Servers

-- name: InsertServerApplicationServer :one
INSERT INTO server_application_servers (id, application_id, name, description, url)
VALUES (@id, @application_id, @name, @description, @url)
RETURNING *;

-- name: UpdateServerApplicationServer :exec
UPDATE server_application_servers SET
    name = @name,
    description = @description,
    url = @url,
    updated_at = now()
WHERE id = @id;

-- name: UpdateServerApplicationServerStatus :exec
UPDATE server_application_servers SET
    status = @status,
    admin_note = sqlc.narg('admin_note'),
    server_id = sqlc.narg('server_id'),
    updated_at = now()
WHERE id = @id;

-- name: ListServerApplicationServers :many
SELECT * FROM server_application_servers
WHERE application_id = @application_id
ORDER BY created_at;

-- name: GetServerApplicationServer :one
SELECT * FROM server_application_servers
WHERE id = @id;

-- Server Application Realms

-- name: InsertServerApplicationRealm :one
INSERT INTO server_application_realms (id, app_server_id, name, description, url)
VALUES (@id, @app_server_id, @name, @description, @url)
RETURNING *;

-- name: UpdateServerApplicationRealm :exec
UPDATE server_application_realms SET
    name = @name,
    description = @description,
    url = @url,
    updated_at = now()
WHERE id = @id;

-- name: UpdateServerApplicationRealmStatus :exec
UPDATE server_application_realms SET
    status = @status,
    admin_note = sqlc.narg('admin_note'),
    realm_id = sqlc.narg('realm_id'),
    updated_at = now()
WHERE id = @id;

-- name: ListServerApplicationRealms :many
SELECT * FROM server_application_realms
WHERE app_server_id = @app_server_id
ORDER BY created_at;

-- name: GetServerApplicationRealm :one
SELECT * FROM server_application_realms
WHERE id = @id;

-- name: ListServerApplicationRealmsByApplicationID :many
SELECT sar.*
FROM server_application_realms sar
JOIN server_application_servers sas ON sas.id = sar.app_server_id
WHERE sas.application_id = @application_id
ORDER BY sar.created_at;
