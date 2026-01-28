BEGIN;

ALTER TABLE log_instances ADD COLUMN hashed_slug TEXT;
CREATE UNIQUE INDEX ON log_instances (hashed_slug) WHERE hashed_slug IS NOT NULL;

COMMIT;