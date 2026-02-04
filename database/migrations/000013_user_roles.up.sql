BEGIN;

CREATE TYPE user_roles AS ENUM (
  'technical_admin',
  'admin',
  'alpha_tester'
  );

ALTER TABLE users ADD COLUMN roles user_roles[] DEFAULT ARRAY[]::user_roles[];

COMMIT;