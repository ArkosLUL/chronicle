package servicepgxpool_test

import (
	"testing"

	"github.com/Emyrk/chronicle/internal/services"
	"github.com/Emyrk/chronicle/internal/services/servicelogger"
	"github.com/Emyrk/chronicle/internal/services/servicepgxpool"
	"github.com/Emyrk/chronicle/internal/testutil"
	"github.com/stretchr/testify/require"
)

func TestPGXPoolService(t *testing.T) {
	t.Parallel()
	logger := testutil.Logger(t)
	ctx := testutil.Context(t, testutil.WaitShort)

	srvs := services.New()
	err := srvs.Register(
		servicelogger.New(srvs),
		servicepgxpool.NewTestPGXPool(t, srvs),
	)
	require.NoError(t, err)

	err = srvs.Start(ctx, logger)
	require.NoError(t, err)

	pool := servicepgxpool.PGXPool(srvs)
	require.NoError(t, pool.Ping(ctx))
}
