BEGIN;

DROP VIEW IF EXISTS log_instances_guild;

CREATE VIEW log_instances_guild AS
SELECT
  log_instances.id,
  log_instances.realm_id,
  log_instances.log_group_id,
  log_instances.name,
  log_instances.hashed_slug,
  log_instances.guild_id,
  guilds.name AS guild_name,
  guilds.realm_id AS guild_realm_id,
  guilds.created_at AS guild_created_at
FROM
  log_instances
  LEFT JOIN guilds ON log_instances.guild_id = guilds.id
;

COMMIT;
