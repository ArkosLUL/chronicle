ALTER TABLE site_config
    ADD COLUMN default_format    log_format,
    ADD COLUMN available_formats text[] NOT NULL DEFAULT '{}';
