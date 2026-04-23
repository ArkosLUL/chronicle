CREATE TABLE server_upload_meta (
  log_group_id UUID PRIMARY KEY REFERENCES wow_log_groups(id) ON DELETE CASCADE,
  instance_id   TEXT NOT NULL,
  instance_name TEXT NOT NULL,
  realm_name    TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_server_upload_meta_lookup
  ON server_upload_meta (instance_id, instance_name, realm_name);
