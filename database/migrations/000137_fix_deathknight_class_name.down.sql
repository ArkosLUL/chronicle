-- Reverse the class name fix (restore original parser format).
UPDATE encounter_dps_rankings SET player_class = 'DEATHKNIGHT' WHERE player_class = 'DEATH_KNIGHT';
UPDATE talent_builds SET player_class = 'DEATHKNIGHT' WHERE player_class = 'DEATH_KNIGHT';
