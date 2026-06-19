ALTER TABLE tenants
    ADD COLUMN default_format    log_format,          -- nullable; NULL = use compiled-in server default
    ADD COLUMN available_formats text[] NOT NULL DEFAULT '{}';
