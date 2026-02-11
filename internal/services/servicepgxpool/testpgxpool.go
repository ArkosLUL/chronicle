package servicepgxpool

import (
	"context"
	"testing"

	"github.com/Emyrk/chronicle/database/dbtestutil"
	"github.com/Emyrk/chronicle/internal/services"
)

type TestPGXPool struct {
	*Service
}

func NewTestPGXPool(t *testing.T, broker *services.Services) *Service {
	connectionURL := dbtestutil.NewConnectionURL(t)
	srv := New(broker)
	srv.pgURL = connectionURL

	t.Cleanup(func() {
		_ = srv.Close(context.Background())
	})
	return srv
}
