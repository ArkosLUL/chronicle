CREATE TABLE shared_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  hash TEXT NOT NULL,
  instance_id UUID NOT NULL REFERENCES log_instances(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shared_views_payload_max_10kb CHECK (octet_length(payload::text) <= 10240),
  CONSTRAINT shared_views_instance_hash_unique UNIQUE (instance_id, hash)
);

CREATE INDEX idx_shared_views_code ON shared_views(code);
CREATE INDEX idx_shared_views_instance_hash ON shared_views(instance_id, hash);
