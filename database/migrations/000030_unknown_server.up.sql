BEGIN;

INSERT INTO wow_servers (id, name) VALUES
  ('89b9a047-71c7-4f0d-96a0-247308a81f90', 'unknown')
;

INSERT INTO wow_server_realms (id, server_id, name) VALUES
  ('f6fb8310-9464-4cf1-a143-aba34f1c3037', '89b9a047-71c7-4f0d-96a0-247308a81f90', 'Unknown')
;

COMMIT;