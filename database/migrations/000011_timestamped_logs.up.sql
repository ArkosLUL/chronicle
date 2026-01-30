BEGIN;

CREATE TABLE log_instance_youtube_timestamped (
    log_instance_id UUID REFERENCES log_instances(id) ON DELETE CASCADE PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    exported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    video_url TEXT NOT NULL,
    -- Maybe should make this first class columns later
    payload JSONB NOT NULL
);

COMMIT;