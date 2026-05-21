-- Create a non-superuser application role for RLS enforcement.
-- The app connects as superuser (for migrations) then SET ROLEs to this role
-- in AfterConnect. Superusers bypass RLS unconditionally, so we need a
-- non-superuser role for the RLS policies (e.g. tenant isolation) to take effect.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'chronicle') THEN
    CREATE ROLE chronicle NOLOGIN;
  END IF;
END $$;

-- Grant the minimum privileges the app needs.
GRANT USAGE ON SCHEMA public TO chronicle;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO chronicle;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO chronicle;

-- Ensure future tables/sequences also get grants.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO chronicle;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO chronicle;
