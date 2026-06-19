ALTER TABLE site_config
    DROP COLUMN IF EXISTS default_format,
    DROP COLUMN IF EXISTS available_formats;
