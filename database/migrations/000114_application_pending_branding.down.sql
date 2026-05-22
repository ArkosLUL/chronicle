-- Re-add columns to server_applications.
ALTER TABLE server_applications
  ADD COLUMN IF NOT EXISTS field_reviews JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS admin_note TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_server_applications_user_active
  ON server_applications(initiated_by) WHERE status = 'pending';

-- Re-create old tables.
CREATE TABLE IF NOT EXISTS server_application_servers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID NOT NULL REFERENCES server_applications(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  url             TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  admin_note      TEXT,
  server_id       UUID REFERENCES wow_servers(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS server_application_realms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_server_id   UUID NOT NULL REFERENCES server_application_servers(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  url             TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  admin_note      TEXT,
  realm_id        UUID REFERENCES wow_server_realms(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TABLE IF EXISTS application_modification_requests;
