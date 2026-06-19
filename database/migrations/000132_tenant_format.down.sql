ALTER TABLE tenants
    DROP COLUMN IF EXISTS default_format,
    DROP COLUMN IF EXISTS available_formats;
