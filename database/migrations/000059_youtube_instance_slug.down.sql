DROP TRIGGER IF EXISTS trg_reattach_by_slug ON log_instances;
DROP FUNCTION IF EXISTS reattach_by_slug();

DROP INDEX IF EXISTS log_instance_youtube_timestamped_instance_id_idx;
DROP INDEX IF EXISTS log_instance_youtube_timestamped_slug_idx;

-- Remove rows with NULL log_instance_id (can't restore NOT NULL otherwise)
DELETE FROM log_instance_youtube_timestamped WHERE log_instance_id IS NULL;

ALTER TABLE log_instance_youtube_timestamped
    DROP CONSTRAINT log_instance_youtube_timestamped_pkey;

ALTER TABLE log_instance_youtube_timestamped
    DROP COLUMN id;

ALTER TABLE log_instance_youtube_timestamped
    ALTER COLUMN log_instance_id SET NOT NULL;

ALTER TABLE log_instance_youtube_timestamped
    DROP CONSTRAINT log_instance_youtube_timestamped_log_instance_id_fkey;

ALTER TABLE log_instance_youtube_timestamped
    ADD CONSTRAINT log_instance_youtube_timestamped_log_instance_id_fkey
    FOREIGN KEY (log_instance_id) REFERENCES log_instances(id) ON DELETE CASCADE;

ALTER TABLE log_instance_youtube_timestamped
    ADD CONSTRAINT log_instance_youtube_timestamped_pkey PRIMARY KEY (log_instance_id);

ALTER TABLE log_instance_youtube_timestamped
    DROP COLUMN instance_slug;
