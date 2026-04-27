-- Central "world" namespace table.
-- Eventually all world_*_template tables will reference this.
CREATE TABLE world (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Junction: servers reference worlds (M:N)
CREATE TABLE world_server (
  server_id   UUID NOT NULL REFERENCES wow_servers(id) ON DELETE CASCADE,
  world_id    UUID NOT NULL REFERENCES world(id) ON DELETE CASCADE,
  PRIMARY KEY (server_id, world_id)
);

-- Replace server_id with world_id on world_instance_template.
-- No data to migrate (table is empty in production).
ALTER TABLE world_instance_template
  DROP CONSTRAINT world_instance_template_server_id_name_key;
ALTER TABLE world_instance_template
  DROP COLUMN server_id;

ALTER TABLE world_instance_template
  ADD COLUMN world_id UUID NOT NULL REFERENCES world(id) ON DELETE CASCADE;
ALTER TABLE world_instance_template
  ADD CONSTRAINT world_instance_template_world_id_name_key UNIQUE (world_id, name);
