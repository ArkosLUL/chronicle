BEGIN;

ALTER TABLE users
  ADD COLUMN raw_log_retention_hours INT;

-- Recreate the chronicle_users view so it picks up the new column.
-- Must DROP first because CREATE OR REPLACE cannot reorder columns.
DROP VIEW chronicle_users;
CREATE VIEW chronicle_users AS
  SELECT
    u.*,
    COALESCE(sl.max_storage_bytes, 0) AS max_storage_bytes,
    sl.updated_at AS data_limit_updated_at,
    COALESCE(lf.total_size_bytes, 0) AS consumed_storage_bytes
  FROM users u
    LEFT JOIN user_storage_limits sl ON sl.user_id = u.id
    LEFT JOIN (
      SELECT owner, SUM(COALESCE(compressed_size_bytes, size_bytes)) AS total_size_bytes
      FROM log_file
      WHERE storage_deleted_at IS NULL
      GROUP BY owner
    ) lf ON lf.owner = u.id;

-- Service account: 48-hour retention for raw log files.
UPDATE users
SET raw_log_retention_hours = 48
WHERE id = '8e3cd4a1-a9f6-4190-8de5-ef037e534981';

COMMIT;
