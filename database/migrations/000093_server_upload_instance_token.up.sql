-- Adds an optional instance_token column used by mod-chronicle to uniquely
-- identify an instance across AzerothCore instance-ID reuse (restarts, resets).
-- When present, token-based matching is preferred over (instance_id, instance_name).
ALTER TABLE server_upload_meta
  ADD COLUMN instance_token TEXT;

CREATE INDEX idx_server_upload_meta_token
  ON server_upload_meta (instance_token)
  WHERE instance_token IS NOT NULL;
