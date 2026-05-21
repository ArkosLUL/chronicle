-- Reverse multi-tenant support.

DROP POLICY IF EXISTS tenant_realm_isolation ON wow_server_realms;
DROP POLICY IF EXISTS tenant_admin_bypass ON wow_server_realms;
ALTER TABLE wow_server_realms DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON wow_servers;
DROP POLICY IF EXISTS tenant_admin_bypass ON wow_servers;
ALTER TABLE wow_servers DISABLE ROW LEVEL SECURITY;

ALTER TABLE wow_servers DROP COLUMN IF EXISTS tenant_id;

DROP TABLE IF EXISTS tenants;
