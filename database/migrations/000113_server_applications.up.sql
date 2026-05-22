CREATE TABLE server_applications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiated_by  UUID NOT NULL REFERENCES users(id),
  status        TEXT NOT NULL DEFAULT 'pending',

  name          TEXT NOT NULL,

  field_reviews  JSONB NOT NULL DEFAULT '{}',

  admin_note     TEXT,
  reviewed_by    UUID REFERENCES users(id),

  tenant_id      UUID NOT NULL REFERENCES tenants(id),

  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_server_applications_user_active
  ON server_applications(initiated_by) WHERE status = 'pending';

CREATE TABLE server_application_servers (
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

CREATE TABLE server_application_realms (
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
