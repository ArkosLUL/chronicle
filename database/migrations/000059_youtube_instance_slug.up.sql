BEGIN;

-- Add nullable slug column + backfill
ALTER TABLE log_instance_youtube_timestamped
    ADD COLUMN instance_slug TEXT;

UPDATE log_instance_youtube_timestamped yt
SET instance_slug = li.hashed_slug
FROM log_instances li
WHERE yt.log_instance_id = li.id
  AND li.hashed_slug IS NOT NULL AND li.hashed_slug != '';

-- Switch PK to surrogate UUID
ALTER TABLE log_instance_youtube_timestamped
    DROP CONSTRAINT log_instance_youtube_timestamped_pkey;

ALTER TABLE log_instance_youtube_timestamped
    ADD COLUMN id UUID DEFAULT gen_random_uuid() NOT NULL;

ALTER TABLE log_instance_youtube_timestamped
    ADD CONSTRAINT log_instance_youtube_timestamped_pkey PRIMARY KEY (id);

-- Make log_instance_id nullable, FK SET NULL instead of CASCADE
ALTER TABLE log_instance_youtube_timestamped
    ALTER COLUMN log_instance_id DROP NOT NULL;

ALTER TABLE log_instance_youtube_timestamped
    DROP CONSTRAINT log_instance_youtube_timestamped_log_instance_id_fkey;

ALTER TABLE log_instance_youtube_timestamped
    ADD CONSTRAINT log_instance_youtube_timestamped_log_instance_id_fkey
    FOREIGN KEY (log_instance_id) REFERENCES log_instances(id) ON DELETE SET NULL;

-- Unique indexes for lookups/upsert (NULLs don't conflict)
CREATE UNIQUE INDEX log_instance_youtube_timestamped_slug_idx
    ON log_instance_youtube_timestamped (instance_slug) WHERE (instance_slug IS NOT NULL);

CREATE UNIQUE INDEX log_instance_youtube_timestamped_instance_id_idx
    ON log_instance_youtube_timestamped (log_instance_id) WHERE (log_instance_id IS NOT NULL);

-- 2. Trigger to reattach slug-linked rows on instance insert
-- noinspection SqlWithoutWhere
CREATE OR REPLACE FUNCTION reattach_by_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.hashed_slug IS NOT NULL AND NEW.hashed_slug != '' THEN
        UPDATE shared_views
        SET instance_id = NEW.id
        WHERE instance_slug = NEW.hashed_slug AND instance_id IS NULL;

        UPDATE log_instance_youtube_timestamped
        SET log_instance_id = NEW.id
        WHERE instance_slug = NEW.hashed_slug AND log_instance_id IS NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reattach_by_slug
    AFTER INSERT ON log_instances
    FOR EACH ROW
    EXECUTE FUNCTION reattach_by_slug();

COMMIT;