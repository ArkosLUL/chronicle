-- Add branding JSONB column to site_config for primary domain branding.
-- Uses the same shape as tenants.branding: {square_logo, display_name, tagline, description, background_banner}.
ALTER TABLE site_config ADD COLUMN branding JSONB;
