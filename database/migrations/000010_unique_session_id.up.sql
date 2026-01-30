BEGIN;

ALTER TABLE user_auth_session ADD COLUMN jwt_id pg_catalog.uuid NOT NULL DEFAULT gen_random_uuid();

COMMIT;