BEGIN;

ALTER TABLE wow_server_upload_keys DROP COLUMN IF EXISTS created_by;
ALTER TABLE wow_server_realms DROP COLUMN IF EXISTS created_by;
ALTER TABLE wow_server_realms DROP COLUMN IF EXISTS url;
ALTER TABLE wow_server_realms DROP COLUMN IF EXISTS description;
ALTER TABLE wow_servers DROP COLUMN IF EXISTS created_by;
ALTER TABLE wow_servers DROP COLUMN IF EXISTS url;
ALTER TABLE wow_servers DROP COLUMN IF EXISTS description;

COMMIT;
