BEGIN;

CREATE TYPE log_instance_event_type AS ENUM (
  'damage',
  'heal',
  'resource_change'
  );

CREATE TABLE log_instance_events(
  instance_id UUID NOT NULL REFERENCES log_instances(id) ON DELETE CASCADE,
  type log_instance_event_type NOT NULL,
  events BYTEA NOT NULL
);

COMMENT ON COLUMN log_instance_events.events IS 'Gzipped protobuf-encoded events';

ALTER TABLE log_instance_encounter_hostiles ADD COLUMN boss BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;