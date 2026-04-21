BEGIN;

INSERT INTO wow_servers (id, name) VALUES
  ('2f7e2ccc-9aa2-4b48-8ee9-b146a9138d06', 'epoch')
;

INSERT INTO wow_server_realms (id, server_id, name) VALUES
    ('e9c0f97b-0b2e-4f47-848c-68634ba6a3dd', '2f7e2ccc-9aa2-4b48-8ee9-b146a9138d06', 'Gurubashi'),
    ('140eaa55-317d-4299-8756-83f495efba15', '2f7e2ccc-9aa2-4b48-8ee9-b146a9138d06', 'Kezen')
;

COMMIT;