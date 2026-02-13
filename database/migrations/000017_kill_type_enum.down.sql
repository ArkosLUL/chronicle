ALTER TABLE log_instance_encounters ADD COLUMN kill BOOLEAN;
UPDATE log_instance_encounters SET kill = (kill_type != 'wipe');
ALTER TABLE log_instance_encounters ALTER COLUMN kill SET NOT NULL;
ALTER TABLE log_instance_encounters DROP COLUMN kill_type;
DROP TYPE kill_type;
