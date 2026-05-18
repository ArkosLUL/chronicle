CREATE TABLE deployment_info (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_telemetry_heartbeat TIMESTAMPTZ
);

-- Insert exactly one row on migration.
INSERT INTO deployment_info DEFAULT VALUES;
