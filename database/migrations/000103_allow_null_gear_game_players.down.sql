UPDATE game_players SET gear = '[]'::jsonb WHERE gear IS NULL;
ALTER TABLE game_players ALTER COLUMN gear SET NOT NULL;
