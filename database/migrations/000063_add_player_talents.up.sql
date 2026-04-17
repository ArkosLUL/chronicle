ALTER TABLE game_players ADD COLUMN talents JSONB NOT NULL DEFAULT 'null'::jsonb;
