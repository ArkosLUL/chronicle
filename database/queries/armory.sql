-- name: UpsertGuild :one
INSERT INTO
  guilds (realm_id, name, created_at)
VALUES
  ($1, $2, $3)
ON CONFLICT (realm_id, name) DO UPDATE
  SET realm_id = EXCLUDED.realm_id  -- no-op, just to return the row
RETURNING *
;


-- name: UpsertPlayers :batchexec
INSERT INTO
  game_players (
    id, realm_id, name, guild_id,
    class, gender, race,
    gear,
    updated_from_instance,
    updated_at
  )
VALUES
  ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
ON CONFLICT (id, realm_id) DO UPDATE
  SET name = EXCLUDED.name,
      guild_id = EXCLUDED.guild_id,
      class = EXCLUDED.class,
      race = EXCLUDED.race,
      gender = EXCLUDED.gender,
      gear = EXCLUDED.gear,
      updated_from_instance = EXCLUDED.updated_from_instance,

      updated_at = EXCLUDED.updated_at
WHERE
  EXCLUDED.updated_at > game_players.updated_at;
;


-- name: GetGamePlayerByGUID :one
SELECT
  gp.*,
  COALESCE(wow_server_realms.name, 'Unknown') as realm_name,
  g.name as guild_name
FROM
  game_players gp
LEFT JOIN guilds g ON g.id = gp.guild_id
LEFT JOIN wow_server_realms ON gp.realm_id = wow_server_realms.id
WHERE
  gp.realm_id = @realm_id
  AND (gp.id = @identifier::wow_guid OR lower(gp.name) = lower(@name))
;