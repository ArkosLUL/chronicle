-- View: best speedrun rank per guild per instance per realm
CREATE VIEW guild_speedrun_ranks AS
SELECT
  instance_id,
  instance_name,
  realm_id,
  guild_id,
  duration_ms,
  RANK() OVER (
    PARTITION BY guild_id, instance_name, realm_id
    ORDER BY duration_ms ASC
  ) AS guild_rank
FROM instance_speedruns
WHERE qualified = true AND guild_id IS NOT NULL;

-- Retention policies scoped to either a server or a realm (not both).
CREATE TABLE retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID REFERENCES wow_servers(id) ON DELETE CASCADE,
  realm_id UUID REFERENCES wow_server_realms(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT retention_policies_scope CHECK (
    (server_id IS NOT NULL AND realm_id IS NULL) OR
    (server_id IS NULL AND realm_id IS NOT NULL)
  ),
  CONSTRAINT retention_policies_unique_server UNIQUE (server_id),
  CONSTRAINT retention_policies_unique_realm UNIQUE (realm_id)
);

-- Ordered rules within a policy. First-match-wins evaluation.
CREATE TABLE retention_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES retention_policies(id) ON DELETE CASCADE,
  priority INT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('keep', 'delete')),
  conditions JSONB NOT NULL DEFAULT '[]',
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT retention_rules_unique_priority UNIQUE (policy_id, priority)
);
