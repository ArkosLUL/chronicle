BEGIN;

CREATE TYPE log_instance_encounter_event_type AS ENUM (
  'damage'
  );

CREATE TABLE log_instance_encounter_events(
  encounter_id UUID NOT NULL REFERENCES log_instance_encounters(id) ON DELETE CASCADE,
  type log_instance_encounter_event_type NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  events BYTEA NOT NULL
);

COMMENT ON COLUMN log_instance_encounter_events.events IS 'Gzipped protobuf-encoded events';

COMMIT;