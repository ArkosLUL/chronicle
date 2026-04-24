ALTER TABLE server_upload_meta
  DROP COLUMN realm_id;

ALTER TABLE server_upload_meta
  ADD COLUMN realm_name TEXT NOT NULL DEFAULT '';

DROP INDEX IF EXISTS idx_server_upload_meta_lookup;
CREATE INDEX idx_server_upload_meta_lookup
  ON server_upload_meta (instance_id, instance_name, realm_name);
