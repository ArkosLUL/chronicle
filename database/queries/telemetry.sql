-- name: GetDeploymentInfo :one
SELECT * FROM deployment_info LIMIT 1;

-- name: UpdateTelemetryHeartbeat :exec
UPDATE deployment_info SET last_telemetry_heartbeat = now();

-- name: TelemetryGetUserCount :one
SELECT COUNT(*)::bigint FROM users;

-- name: TelemetryGetLogFileCount :one
SELECT COUNT(*)::bigint FROM log_file;

-- name: TelemetryGetTotalParsedBytes :one
SELECT COALESCE(SUM(octet_length(events)), 0)::bigint FROM log_instance_events;

-- name: TelemetryGetActiveFileBytes :one
SELECT COALESCE(SUM(size_bytes), 0)::bigint FROM log_file
WHERE storage_deleted_at IS NULL;

-- name: TelemetryGetDeletedFileBytes :one
SELECT COALESCE(SUM(size_bytes), 0)::bigint FROM log_file
WHERE storage_deleted_at IS NOT NULL;

-- name: TelemetryGetLogCountByZone :many
SELECT
    li.name AS zone_name,
    COUNT(*)::bigint AS log_count
FROM log_instances li
GROUP BY li.name;
