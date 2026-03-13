BEGIN;

CREATE TYPE wow_playable_gender AS ENUM(
  'NotSet', 'Unknown', 'Male', 'Female'
);

CREATE TABLE game_players (
  -- Static values
  id wow_guid NOT NULL,
  realm_id uuid NOT NULL REFERENCES wow_server_realms(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Mutable
  guild_id uuid REFERENCES guilds(id) ON DELETE SET NULL,
  name text NOT NULL,
  class wow_playable_class NOT NULL,
  gender wow_playable_gender NOT NULL,
  race wow_playable_race NOT NULL,
  gear JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Talents?
  -- Nice to track where the data came from
  updated_from_instance uuid REFERENCES log_instances(id) ON DELETE SET NULL INITIALLY DEFERRED,
  PRIMARY KEY(id, realm_id)
);

CREATE INDEX game_players_player_and_realm ON game_players USING btree (name, realm_id);

COMMIT;