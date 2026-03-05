BEGIN;

CREATE OR REPLACE FUNCTION insert_default_data_grant()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO data_grants (user_id, source, storage_bytes, description)
  VALUES (NEW.id, 'base', 150000000, 'Default storage allocation');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

END;
