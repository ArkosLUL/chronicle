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
  *
FROM
  game_players
WHERE
  id = $1 AND realm_id = $2
;