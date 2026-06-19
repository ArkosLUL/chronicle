-- pgx cannot scan log_format[] (custom enum array) by OID; use text[] instead.
ALTER TABLE tenants
    ALTER COLUMN available_formats TYPE text[] USING available_formats::text[];
