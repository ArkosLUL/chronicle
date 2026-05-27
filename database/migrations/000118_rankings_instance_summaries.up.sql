CREATE TABLE rankings_instance_summaries (
    instance_name   TEXT NOT NULL,
    difficulty_name TEXT NOT NULL DEFAULT '',
    max_players     SMALLINT NOT NULL DEFAULT 0,
    -- uuid.Nil = root domain (untenanted + include_in_all realms).
    -- Real UUID = specific tenant's realms.
    tenant_id       UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    total_kills     BIGINT NOT NULL DEFAULT 0,
    top_players     JSONB  NOT NULL DEFAULT '[]'::jsonb,
    -- Snapshot of encounter_dps_rankings row count at last refresh.
    -- Used as a staleness guard to skip refresh when count is unchanged.
    last_row_count  BIGINT NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (instance_name, difficulty_name, max_players, tenant_id)
);
