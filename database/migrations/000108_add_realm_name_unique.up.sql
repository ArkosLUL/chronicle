CREATE UNIQUE INDEX idx_wow_server_realms_name_unique ON wow_server_realms (lower(name));
CREATE UNIQUE INDEX idx_wow_servers_name_unique ON wow_servers (lower(name));
CREATE UNIQUE INDEX idx_tenants_name_unique ON tenants (lower(name));
