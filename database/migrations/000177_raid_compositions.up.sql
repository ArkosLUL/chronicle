CREATE TABLE raid_compositions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Tenant the composition was saved on. The zero UUID means the root domain
  -- (no tenant). Compositions are only listed on the tenant they were saved on.
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  -- Optional guild this composition plans for.
  guild_id UUID REFERENCES guilds(id) ON DELETE SET NULL,

  name TEXT NOT NULL,
  -- Typed composition payload (chroniclesdk.RaidCompData): groups, bench,
  -- group notes.
  data JSONB NOT NULL,
  -- Mirror of the SpiceDB public_viewer wildcard relation, kept for display;
  -- SpiceDB is the enforcement source of truth.
  public_view BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT raid_compositions_name_length_chk CHECK (char_length(name) BETWEEN 1 AND 100),
  CONSTRAINT raid_compositions_data_size_chk CHECK (pg_column_size(data) <= 131072)
);

CREATE INDEX raid_compositions_user_tenant_idx ON raid_compositions (user_id, tenant_id);
