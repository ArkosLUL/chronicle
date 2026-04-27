-- name: FindMatchingServerUpload :one
-- Matches an existing log group by all available instance identity criteria:
-- instance_token (unique per instance, immune to AzerothCore ID reuse),
-- instance_id, instance_name, and realm_id.
SELECT wlg.*
FROM wow_log_groups wlg
JOIN server_upload_meta sm ON sm.log_group_id = wlg.id
WHERE wlg.owner = @owner
  AND sm.instance_token = @instance_token
  AND sm.instance_id = @instance_id
  AND sm.instance_name = @instance_name
  AND sm.realm_id IS NOT DISTINCT FROM @realm_id
  AND wlg.log_type = 'azerothcore'
  AND sm.created_at > now() - interval '24 hours'
ORDER BY sm.created_at DESC
LIMIT 1;

-- name: InsertServerUploadMeta :exec
INSERT INTO server_upload_meta (log_group_id, instance_id, instance_name, realm_id, instance_token)
VALUES (@log_group_id, @instance_id, @instance_name, @realm_id, @instance_token);

-- name: GetServerUploadMetaRealmID :one
SELECT realm_id FROM server_upload_meta WHERE log_group_id = @log_group_id;
