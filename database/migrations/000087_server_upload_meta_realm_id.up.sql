ALTER TABLE server_upload_meta
  DROP COLUMN realm_name;

ALTER TABLE server_upload_meta
  ADD COLUMN realm_id UUID REFERENCES wow_server_realms(id) ON DELETE CASCADE;

DROP INDEX IF EXISTS idx_server_upload_meta_lookup;
CREATE INDEX idx_server_upload_meta_lookup
  ON server_upload_meta (instance_id, instance_name, realm_id);
