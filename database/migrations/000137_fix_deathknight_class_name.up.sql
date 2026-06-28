-- Fix class name mismatch: parser stored "DEATHKNIGHT" but DB enum is "DEATH_KNIGHT".
UPDATE encounter_dps_rankings SET player_class = 'DEATH_KNIGHT' WHERE player_class = 'DEATHKNIGHT';
UPDATE talent_builds SET player_class = 'DEATH_KNIGHT' WHERE player_class = 'DEATHKNIGHT';
