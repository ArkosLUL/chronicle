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

-- name: ListServerApplications :many
SELECT sa.*, u.username
FROM server_applications sa
JOIN users u ON u.id = sa.initiated_by
ORDER BY sa.created_at DESC;

-- Modification Requests

-- name: InsertModificationRequest :one
INSERT INTO application_modification_requests
  (id, application_id, type, parent_id, payload)
VALUES (@id, @application_id, @type, @parent_id, @payload)
RETURNING *;

-- name: UpsertPendingModificationRequest :one
INSERT INTO application_modification_requests
  (id, application_id, type, parent_id, payload)
VALUES (@id, @application_id, @type, @parent_id, @payload)
ON CONFLICT (application_id, type, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'))
  WHERE status = 'pending' AND type NOT IN ('server', 'realm')
DO UPDATE SET
  payload = EXCLUDED.payload,
  updated_at = now()
RETURNING *;

-- name: GetModificationRequestByID :one
SELECT * FROM application_modification_requests
WHERE id = @id;

-- name: UpdateModificationRequestPayload :exec
UPDATE application_modification_requests SET
    payload = @payload,
    updated_at = now()
WHERE id = @id;

-- name: UpdateModificationRequestStatus :exec
UPDATE application_modification_requests SET
    status = @status,
    admin_note = sqlc.narg('admin_note'),
    reviewed_by = sqlc.narg('reviewed_by'),
    reviewed_at = sqlc.narg('reviewed_at'),
    resource_id = sqlc.narg('resource_id'),
    updated_at = now()
WHERE id = @id;

-- name: DeleteModificationRequest :exec
DELETE FROM application_modification_requests WHERE id = @id;

-- name: ListModificationRequestsByApplicationID :many
SELECT * FROM application_modification_requests
WHERE application_id = @application_id
ORDER BY created_at;
