BEGIN;

-- Global guild entities (realm-scoped)
CREATE TABLE guilds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id UUID NOT NULL REFERENCES wow_server_realms(id),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(realm_id, name)
);

-- Add to existing player table
ALTER TABLE log_instance_players
  ADD COLUMN guild_id UUID REFERENCES guilds(id)
;

ALTER TABLE log_instances ADD COLUMN guild_id UUID DEFAULT NULL REFERENCES guilds(id);
COMMENT ON COLUMN log_instances.guild_id IS 'If set, that means it was a guild run.';

ALTER TABLE log_file
ALTER COLUMN wow_log_id SET NOT NULL;

CREATE VIEW log_instances_guild AS
SELECT
  log_instances.*,
  guilds.name AS guild_name,
  guilds.realm_id AS guild_realm_id,
  guilds.created_at AS guild_created_at
FROM
  log_instances
    LEFT JOIN
  guilds ON log_instances.guild_id = guilds.id
;


COMMIT;