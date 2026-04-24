package authz

import (
	"context"
	"fmt"

	"github.com/Emyrk/chronicle/database/authz/policy"
	"github.com/google/uuid"
)

// AuthzMigration is a numbered authz schema migration.
// Append new migrations to the migrations slice with the next version number.
type AuthzMigration struct {
	Version int32
	Run     func(ctx context.Context, az *Authz) error
}

// migrations is the ordered list of authz migrations.
// To add a new migration, append an entry with the next version number.
var migrations = []AuthzMigration{
	{Version: 1, Run: migration001},
}

// RunSchemaMigrations runs any authz migrations not yet recorded in the
// authz_schema_migrations table.
func RunSchemaMigrations(ctx context.Context, az *Authz) error {
	applied, err := az.db.GetAppliedAuthzMigrations(ctx)
	if err != nil {
		return fmt.Errorf("get applied authz migrations: %w", err)
	}

	appliedSet := make(map[int32]bool, len(applied))
	for _, v := range applied {
		appliedSet[v] = true
	}

	for _, m := range migrations {
		if appliedSet[m.Version] {
			continue
		}
		if err := m.Run(ctx, az); err != nil {
			return fmt.Errorf("authz migration %d: %w", m.Version, err)
		}
		if err := az.db.RecordAuthzMigration(ctx, m.Version); err != nil {
			return fmt.Errorf("record authz migration %d: %w", m.Version, err)
		}
	}
	return nil
}

// migration001 seeds servers and realms (originally from RunSchemaMigrations).
func migration001(ctx context.Context, az *Authz) error {
	b := policy.New()
	chron := b.GlobalChronicle()

	// Servers (from migrations 000002, 000030, 000080)
	turtleWow := uuid.MustParse("10ac9e23-ff74-43ed-83ad-96c123017097")
	unknown := uuid.MustParse("89b9a047-71c7-4f0d-96a0-247308a81f90")
	epoch := uuid.MustParse("2f7e2ccc-9aa2-4b48-8ee9-b146a9138d06")

	b.Wow_server(turtleWow).Chronicle(chron)
	b.Wow_server(unknown).Chronicle(chron)
	b.Wow_server(epoch).Chronicle(chron)

	// Realms — turtle-wow
	b.Wow_server_realm(uuid.MustParse("851d2fd3-f9c5-4623-b714-924b59d916aa")).
		Wow_server(b.Wow_server(turtleWow))
	b.Wow_server_realm(uuid.MustParse("f94d3103-1cd8-40e9-ad91-a2366de33354")).
		Wow_server(b.Wow_server(turtleWow))
	b.Wow_server_realm(uuid.MustParse("bcf173a7-c94a-49fe-8930-27435d722fb7")).
		Wow_server(b.Wow_server(turtleWow))

	// Realms — unknown
	b.Wow_server_realm(uuid.MustParse("f6fb8310-9464-4cf1-a143-aba34f1c3037")).
		Wow_server(b.Wow_server(unknown))

	// Realms — epoch
	b.Wow_server_realm(uuid.MustParse("e9c0f97b-0b2e-4f47-848c-68634ba6a3dd")).
		Wow_server(b.Wow_server(epoch))
	b.Wow_server_realm(uuid.MustParse("140eaa55-317d-4299-8756-83f495efba15")).
		Wow_server(b.Wow_server(epoch))

	// TOUCH is idempotent — safe to run on every startup.
	_, err := az.Write(ctx, *b.Txn())
	return err
}
