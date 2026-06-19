ALTER TABLE tenants
    ALTER COLUMN available_formats TYPE log_format[] USING available_formats::log_format[];
