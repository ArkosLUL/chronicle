BEGIN;

CREATE TYPE log_instance_message_type AS ENUM (
  'damage'
  );

CREATE TABLE log_instance_messages (
  encounter_id UUID NOT NULL REFERENCES log_instance_encounters(id) ON DELETE CASCADE,
  type log_instance_message_type NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  messages BYTEA NOT NULL
);

COMMENT ON COLUMN log_instance_messages.messages IS 'Gzipped protobuf-encoded messages';

COMMIT;