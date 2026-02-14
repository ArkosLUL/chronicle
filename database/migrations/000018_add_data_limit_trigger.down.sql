BEGIN;

DROP TRIGGER IF EXISTS trigger_insert_default_data_limit ON users;
DROP FUNCTION IF EXISTS insert_default_data_limit();

END;
