-- Add slug column to shared_views
ALTER TABLE shared_views ADD COLUMN instance_slug TEXT NOT NULL DEFAULT '';

-- Backfill slugs from existing instances
UPDATE shared_views sv
SET instance_slug = li.hashed_slug
FROM log_instances li
WHERE sv.instance_id = li.id
  AND li.hashed_slug IS NOT NULL
  AND li.hashed_slug != '';

-- Make instance_id nullable so rows survive cascade
ALTER TABLE shared_views ALTER COLUMN instance_id DROP NOT NULL;

-- Change FK to SET NULL instead of CASCADE
ALTER TABLE shared_views DROP CONSTRAINT shared_views_instance_id_fkey;
ALTER TABLE shared_views ADD CONSTRAINT shared_views_instance_id_fkey
  FOREIGN KEY (instance_id) REFERENCES log_instances(id) ON DELETE SET NULL;
