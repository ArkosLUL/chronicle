-- name: InsertLogInstanceEvents :batchexec
INSERT INTO
  log_instance_events(instance_id, type, events)
VALUES
  ($1, $2, $3)
;

-- name: InstanceEvent :one
SELECT
  log_instance_events.*
FROM
  log_instance_events
LEFT JOIN
    log_instances
    ON log_instance_events.instance_id = log_instances.id
WHERE
  instance_id = $1 AND
  log_instance_events.type =sqlc.arg('type') :: text :: log_instance_event_type
;