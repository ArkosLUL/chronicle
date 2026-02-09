package servicepgxpool

import (
	"testing"

	"github.com/Emyrk/chronicle/database/dbtestutil"
	"github.com/Emyrk/chronicle/internal/services"
)

type TestPGXPool struct {
	*Service
	t *testing.T
}

func NewTestPGXPool(t *testing.T, broker *services.Services) *Service {
	connectionURL := dbtestutil.NewConnectionURL(t)
	srv := New(broker)
	srv.pgURL = connectionURL

	t.Cleanup(func() {
		if srv.pool == nil {
			return
		}
		srv.pool.Close()
	})
	return srv
}
