BEGIN;

-- Recreate data_limit table
CREATE TABLE data_limit (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  max_storage_bytes BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migrate grants back to data_limit (sum all grants per user)
INSERT INTO data_limit (user_id, max_storage_bytes, updated_at)
SELECT 
  user_id, 
  SUM(storage_bytes), 
  MAX(created_at)
FROM data_grants
WHERE expires_at IS NULL OR expires_at > NOW()
GROUP BY user_id;

-- Restore original chronicle_users view
DROP VIEW chronicle_users;
DROP VIEW user_storage_limits;

CREATE VIEW chronicle_users AS
  SELECT
    u.*,
    dl.max_storage_bytes,
    dl.updated_at AS data_limit_updated_at,
    COALESCE(lf.total_size_bytes, 0) AS consumed_storage_bytes
  FROM users u
    LEFT JOIN data_limit dl ON dl.user_id = u.id
    LEFT JOIN (
      SELECT owner, SUM(size_bytes) AS total_size_bytes
      FROM log_file
      WHERE storage_deleted_at IS NULL
      GROUP BY owner
    ) lf ON lf.owner = u.id;

-- Restore original trigger
DROP TRIGGER IF EXISTS trigger_insert_default_data_grant ON users;
DROP FUNCTION IF EXISTS insert_default_data_grant();

CREATE FUNCTION insert_default_data_limit()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO data_limit (user_id, max_storage_bytes)
  VALUES (NEW.id, 500000000);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_insert_default_data_limit
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION insert_default_data_limit();

-- Drop grants table
DROP TABLE data_grants;

END;
