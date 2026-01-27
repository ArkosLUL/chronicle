-- name: InsertLogEncounterEvents :batchexec
INSERT INTO
  log_instance_encounter_events(encounter_id, start_time, type, events)
VALUES
  ($1, $2, $3, $4)
;

-- name: InstanceEncounterEvents :many
SELECT
  log_instance_encounter_events.*
FROM
  log_instance_encounter_events
LEFT JOIN
    log_instance_encounters
    ON log_instance_encounter_events.encounter_id = log_instance_encounters.id
WHERE
  instance_id = $1 AND
  log_instance_encounter_events.type = ANY(sqlc.arg('types') :: log_instance_encounter_event_type[])
;