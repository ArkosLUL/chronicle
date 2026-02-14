BEGIN;

-- Backfill: Insert data_limit for any users who don't have one
INSERT INTO data_limit (user_id, max_storage_bytes)
SELECT id, 500000000 -- 500MB default
FROM users
WHERE id NOT IN (SELECT user_id FROM data_limit);

-- Function to insert default data_limit row when a user is created
CREATE OR REPLACE FUNCTION insert_default_data_limit()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO data_limit (user_id, max_storage_bytes)
  VALUES (NEW.id, 500000000); -- 500MB default
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function after user insert
CREATE TRIGGER trigger_insert_default_data_limit
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION insert_default_data_limit();

END;
