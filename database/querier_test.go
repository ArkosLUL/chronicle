package database_test

import (
	"context"
	"testing"
	"time"

	"github.com/Emyrk/chronicle/database"
	"github.com/Emyrk/chronicle/database/dbtestutil"
	"github.com/Emyrk/chronicle/internal/testutil"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDatabaseWorks(t *testing.T) {
	t.Parallel()
	ctx := testutil.Context(t, testutil.WaitShort)

	db, pubsub := dbtestutil.NewDB(t)
	dur, err := db.Ping(ctx)
	require.NoError(t, err)
	t.Logf("Ping: %s", dur)

	t.Run("User Insertion in Transaction", func(t *testing.T) {
		t.Parallel()
		ctx := testutil.Context(t, testutil.WaitShort)

		expected := uuid.New()
		err = db.InTx(func(tx database.Store) error {
			_, err := tx.InsertUser(ctx, database.InsertUserParams{
				ID:       expected,
				Username: "random",
			})
			return err
		}, nil)
		require.NoError(t, err)

		user, err := db.GetUserByID(ctx, expected)
		require.NoError(t, err)
		require.Equal(t, expected, user.ID)
		require.Equal(t, "random", user.Username)
	})

	t.Run("Basic pubsub", func(t *testing.T) {
		t.Parallel()
		ctx := testutil.Context(t, testutil.WaitShort)
		const channel = "test-channel"

		received := make(chan []byte)
		done, err := pubsub.Subscribe(channel, func(ctx context.Context, message []byte) {
			received <- message
		})
		require.NoError(t, err)
		defer done()

		expected := []byte("hello world")
		go func() {
			time.Sleep(time.Millisecond * 50)
			err = pubsub.Publish(channel, expected)
			assert.NoError(t, err)
		}()

		got := testutil.RequireReceive(ctx, t, received)
		require.Equal(t, expected, got)
	})
}
