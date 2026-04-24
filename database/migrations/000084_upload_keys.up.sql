BEGIN;

CREATE TABLE wow_server_upload_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id     UUID NOT NULL REFERENCES wow_server_realms(id) ON DELETE CASCADE,
  secret_hash  TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX idx_upload_keys_realm ON wow_server_upload_keys(realm_id);

COMMIT;
