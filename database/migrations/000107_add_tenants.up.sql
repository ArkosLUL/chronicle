-- Multi-tenant support: tenants table, wow_servers.tenant_id, RLS policies.

CREATE TABLE tenants (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                  TEXT UNIQUE,
    name                  TEXT NOT NULL,
    disable_client_upload BOOLEAN NOT NULL DEFAULT false,
    include_in_all        BOOLEAN NOT NULL DEFAULT true,
    -- Branding: {logo, banner, wide_logo}
    branding              JSONB,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Slug: lowercase alphanumeric + hyphens, 3-32 chars.
ALTER TABLE tenants ADD CONSTRAINT tenants_slug_format
    CHECK (slug IS NULL OR slug ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$');

-- Reserve slugs that could collide with infrastructure subdomains.
ALTER TABLE tenants ADD CONSTRAINT tenants_slug_reserved
    CHECK (slug NOT IN ('www', 'api', 'auth', 'admin', 'legacy', 'app', 'mail', 'staging'));

-- Link servers to tenants. NULL = untenanted (legacy, always visible on root domain).
ALTER TABLE wow_servers ADD COLUMN tenant_id UUID REFERENCES tenants(id);

-- RLS on wow_servers: the gateway for all tenant scoping.
ALTER TABLE wow_servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE wow_servers FORCE ROW LEVEL SECURITY;

-- Bypass policy: admin/background jobs set app.tenant_bypass = 'true'.
CREATE POLICY tenant_admin_bypass ON wow_servers
    USING (current_setting('app.tenant_bypass', true) = 'true');

-- Tenant isolation: root domain sees untenanted + include_in_all; subdomain sees only its tenant.
CREATE POLICY tenant_isolation ON wow_servers
    USING (
        CASE
            WHEN nullif(current_setting('app.tenant_id', true), '') IS NULL THEN
                tenant_id IS NULL
                OR tenant_id IN (SELECT id FROM tenants WHERE include_in_all = true)
            ELSE
                tenant_id = current_setting('app.tenant_id', true)::uuid
        END
    );

-- RLS on wow_server_realms: cascades through wow_servers RLS via JOIN.
ALTER TABLE wow_server_realms ENABLE ROW LEVEL SECURITY;
ALTER TABLE wow_server_realms FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_admin_bypass ON wow_server_realms
    USING (current_setting('app.tenant_bypass', true) = 'true');

CREATE POLICY tenant_realm_isolation ON wow_server_realms
    USING (
        server_id IN (SELECT id FROM wow_servers)
    );
