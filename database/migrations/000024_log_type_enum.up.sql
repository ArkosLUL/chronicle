CREATE TYPE log_type AS ENUM ('v1', 'v2');

ALTER TABLE wow_log_groups 
ADD COLUMN log_type log_type NOT NULL DEFAULT 'v1';
