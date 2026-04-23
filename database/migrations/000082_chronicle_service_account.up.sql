BEGIN;

-- Well-known service account for server-side log uploads.
-- The AFTER INSERT trigger on users auto-creates a 500MB data_grant ("base").
INSERT INTO users (id, username, email, created_at, updated_at)
VALUES (
    '8e3cd4a1-a9f6-4190-8de5-ef037e534981',
    'chronicle-service',
    'service@chronicle.internal',
    NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Bump storage to ~50 GB (trigger gave 500MB as "base").
INSERT INTO data_grants (user_id, source, storage_bytes, description)
VALUES (
    '8e3cd4a1-a9f6-4190-8de5-ef037e534981',
    'service',
    49500000000,
    'Server-side upload storage'
)
ON CONFLICT (user_id, source) DO NOTHING;


COMMIT;