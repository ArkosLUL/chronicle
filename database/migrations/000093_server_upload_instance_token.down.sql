DROP INDEX IF EXISTS idx_server_upload_meta_token;

ALTER TABLE server_upload_meta
  DROP COLUMN IF EXISTS instance_token;
