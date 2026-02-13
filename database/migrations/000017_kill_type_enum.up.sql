-- Create the enum type
CREATE TYPE kill_type AS ENUM ('clean', 'partial', 'wipe');

-- Add new column
ALTER TABLE log_instance_encounters 
  ADD COLUMN kill_type kill_type;

-- Migrate existing data:
-- - kill=true AND remaining is empty → 'clean'
-- - kill=true AND remaining not empty → 'wipe' (legacy data, treat as wipe)
-- - kill=false → 'wipe'
UPDATE log_instance_encounters SET kill_type = 
  CASE 
    WHEN kill = true THEN 'clean'::kill_type
    ELSE 'wipe'::kill_type
  END;

-- Make NOT NULL after migration
ALTER TABLE log_instance_encounters 
  ALTER COLUMN kill_type SET NOT NULL;

-- Drop old column
ALTER TABLE log_instance_encounters DROP COLUMN kill;
