-- PostgreSQL doesn't support removing enum values directly.
-- This migration cannot be easily reversed without recreating the type.
-- If needed, you would have to:
-- 1. Create a new type without 'reset'
-- 2. Update all columns using the type
-- 3. Drop the old type
-- 4. Rename the new type

-- For now, we leave this as a no-op since removing enum values is complex
-- and 'reset' being present doesn't break anything.
