-- Unified modification request table replacing field_reviews, server_application_servers,
-- and server_application_realms.
CREATE TABLE application_modification_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID NOT NULL REFERENCES server_applications(id) ON DELETE CASCADE,

  -- 'core' | 'slug' | 'description' | 'logos' | 'theme' | 'server' | 'realm'
  type            TEXT NOT NULL,

  -- For realm requests: references the parent server mod request (approved).
  parent_id       UUID REFERENCES application_modification_requests(id),

  -- Proposed change as JSON. Shape depends on type.
  payload         JSONB NOT NULL,

  status          TEXT NOT NULL DEFAULT 'pending',
  admin_note      TEXT,
  reviewed_by     UUID REFERENCES users(id),
  reviewed_at     TIMESTAMPTZ,

  -- For server/realm: the provisioned resource ID (set on approval).
  resource_id     UUID,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One pending request per (application, type, parent). Enforces upsert-single-pending.
CREATE UNIQUE INDEX idx_mod_requests_pending
  ON application_modification_requests(application_id, type, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'))
  WHERE status = 'pending';

-- Drop old columns from server_applications (handled by mod requests now).
ALTER TABLE server_applications
  DROP COLUMN IF EXISTS field_reviews,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS admin_note,
  DROP COLUMN IF EXISTS reviewed_by;

DROP INDEX IF EXISTS idx_server_applications_user_active;

-- Drop old tables.
DROP TABLE IF EXISTS server_application_realms;
DROP TABLE IF EXISTS server_application_servers;
