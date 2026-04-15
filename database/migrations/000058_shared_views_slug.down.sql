-- Delete orphaned rows (no instance_id) before re-adding NOT NULL
DELETE FROM shared_views WHERE instance_id IS NULL;

ALTER TABLE shared_views DROP CONSTRAINT shared_views_instance_id_fkey;
ALTER TABLE shared_views ADD CONSTRAINT shared_views_instance_id_fkey
  FOREIGN KEY (instance_id) REFERENCES log_instances(id) ON DELETE CASCADE;

ALTER TABLE shared_views ALTER COLUMN instance_id SET NOT NULL;
ALTER TABLE shared_views DROP COLUMN instance_slug;
