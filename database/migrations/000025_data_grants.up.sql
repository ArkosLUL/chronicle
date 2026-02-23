BEGIN;

-- Create the grants table
CREATE TABLE data_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source TEXT NOT NULL,           -- e.g., "base", "alpha-tester", "support"
  storage_bytes BIGINT NOT NULL,  -- grant amount in bytes
  description TEXT,               -- optional human-readable note
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,         -- NULL = never expires
  UNIQUE(user_id, source)         -- one grant per source per user
);

CREATE INDEX idx_data_grants_user_id ON data_grants(user_id);

-- Migrate existing data_limit to grants
INSERT INTO data_grants (user_id, source, storage_bytes, description, created_at)
SELECT user_id, 'base', max_storage_bytes, 'Migrated from data_limit', updated_at
FROM data_limit;

-- Create a view for aggregated storage limits per user
CREATE VIEW user_storage_limits AS
  SELECT
    user_id,
    SUM(storage_bytes) AS max_storage_bytes,
    MAX(created_at) AS updated_at
  FROM data_grants
  WHERE expires_at IS NULL OR expires_at > NOW()
  GROUP BY user_id;

-- Update the chronicle_users view to use the new storage limits view
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
      SELECT owner, SUM(size_bytes) AS total_size_bytes
      FROM log_file
      WHERE storage_deleted_at IS NULL
      GROUP BY owner
    ) lf ON lf.owner = u.id;

-- Update trigger to insert base grant instead of data_limit row
DROP TRIGGER IF EXISTS trigger_insert_default_data_limit ON users;
DROP FUNCTION IF EXISTS insert_default_data_limit();

CREATE FUNCTION insert_default_data_grant()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO data_grants (user_id, source, storage_bytes, description)
  VALUES (NEW.id, 'base', 500000000, 'Default storage allocation');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_insert_default_data_grant
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION insert_default_data_grant();

-- Drop old table
DROP TABLE data_limit;

END;
