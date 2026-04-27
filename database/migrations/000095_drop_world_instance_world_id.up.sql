ALTER TABLE world_instance_template
  DROP CONSTRAINT world_instance_template_world_id_name_key;
ALTER TABLE world_instance_template
  DROP COLUMN world_id;
ALTER TABLE world_instance_template
  ADD CONSTRAINT world_instance_template_name_key UNIQUE (name);
