package servicetenant

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// PrepareConn sets the tenant session variable on a connection.
// Called from the pgxpool PrepareConn hook — reads tenant from ctx.
//
// Behavior:
//   - Bypass context → SET app.tenant_bypass = 'true'
//   - Tenant in context → SET app.tenant_id = '<uuid>'
//   - No tenant → no-op (root domain; RLS defaults to showing untenanted + include_in_all)
func PrepareConn(ctx context.Context, conn *pgx.Conn) error {
	if isBypass(ctx) {
		_, err := conn.Exec(ctx, "SET app.tenant_bypass = 'true'")
		return err
	}
	tenantID := TenantIDFromContext(ctx)
	if tenantID != uuid.Nil {
		// SET doesn't support parameterized queries — use fmt.Sprintf.
		// Safe: tenantID is a uuid.UUID we parsed, not user input.
		_, err := conn.Exec(ctx, fmt.Sprintf("SET app.tenant_id = '%s'", tenantID.String()))
		return err
	}
	return nil
}

// ResetConn clears tenant session variables on a connection.
// Called from the pgxpool AfterRelease hook.
func ResetConn(conn *pgx.Conn) {
	// RESET is fast (~0.1ms) and always safe. We reset both variables
	// to ensure no tenant state leaks between pool acquisitions.
	_, _ = conn.Exec(context.Background(), "RESET app.tenant_id")
	_, _ = conn.Exec(context.Background(), "RESET app.tenant_bypass")
}

// CheckNestedTx verifies that a nested InTx call has the same tenant scope as
// the outer transaction. Mixing tenant scopes within a single transaction is a
// bug — the connection's SET from the outer BeginTx won't change mid-tx.
func CheckNestedTx(outerCtx, innerCtx context.Context) error {
	outerBypass := isBypass(outerCtx)
	innerBypass := isBypass(innerCtx)
	if outerBypass != innerBypass {
		return fmt.Errorf("outer tx bypass=%v but nested InTx bypass=%v", outerBypass, innerBypass)
	}

	outerTenant := TenantIDFromContext(outerCtx)
	innerTenant := TenantIDFromContext(innerCtx)
	if outerTenant != innerTenant {
		return fmt.Errorf("outer tx tenant=%s but nested InTx tenant=%s", outerTenant, innerTenant)
	}

	return nil
}
