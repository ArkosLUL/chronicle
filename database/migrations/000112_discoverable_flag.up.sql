-- Opt-in flag for the /api/v1/discovery endpoint.
-- Tenants and the primary site must set discoverable = true to appear.
ALTER TABLE tenants ADD COLUMN discoverable BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE site_config ADD COLUMN discoverable BOOLEAN NOT NULL DEFAULT false;
