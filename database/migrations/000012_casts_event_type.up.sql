BEGIN;

ALTER TYPE log_instance_event_type ADD VALUE 'cast';
ALTER TYPE log_instance_event_type ADD VALUE 'aura';

COMMIT;