ALTER TABLE world_instance_template
  DROP CONSTRAINT world_instance_template_world_id_name_key;
ALTER TABLE world_instance_template
  DROP COLUMN world_id;

ALTER TABLE world_instance_template
  ADD COLUMN server_id UUID NOT NULL REFERENCES wow_servers(id);
ALTER TABLE world_instance_template
  ADD CONSTRAINT world_instance_template_server_id_name_key UNIQUE (server_id, name);

DROP TABLE world_server;
DROP TABLE world;
