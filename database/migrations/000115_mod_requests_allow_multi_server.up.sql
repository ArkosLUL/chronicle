-- Allow multiple pending server/realm requests per application.
DROP INDEX IF EXISTS idx_mod_requests_pending;

CREATE UNIQUE INDEX idx_mod_requests_pending
  ON application_modification_requests(application_id, type, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'))
  WHERE status = 'pending' AND type NOT IN ('server', 'realm');
