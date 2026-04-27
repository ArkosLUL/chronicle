ALTER TABLE world_instance_template
  DROP CONSTRAINT world_instance_template_name_key;
ALTER TABLE world_instance_template
  ADD COLUMN world_id UUID REFERENCES world(id) ON DELETE CASCADE;
ALTER TABLE world_instance_template
  ADD CONSTRAINT world_instance_template_world_id_name_key UNIQUE (world_id, name);
