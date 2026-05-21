package database_test

import (
	"context"
	"testing"
	"time"

	"github.com/Emyrk/chronicle/database"
	"github.com/Emyrk/chronicle/database/dbtestutil"
	"github.com/Emyrk/chronicle/internal/testutil"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
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
		err = db.InTx(ctx, func(tx database.Store) error {
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

	t.Run("Consumed storage uses compressed size when available", func(t *testing.T) {
		t.Parallel()
		ctx := testutil.Context(t, testutil.WaitShort)

		userID := uuid.New()
		_, err := db.InsertUser(ctx, database.InsertUserParams{
			ID:       userID,
			Username: "storage-user",
			Email:    "storage-user@example.com",
		})
		require.NoError(t, err)

		now := time.Now()
		logGroupID := uuid.New()
		_, err = db.InsertWoWLogGroup(ctx, database.InsertWoWLogGroupParams{
			ID:        logGroupID,
			Owner:     userID,
			LogType:   database.LogTypeV1,
			CreatedAt: database.Timestamptz(now),
			UpdatedAt: database.Timestamptz(now),
		})
		require.NoError(t, err)

		compressedSize := int64(400)
		_, err = db.InsertLogFile(ctx, database.InsertLogFileParams{
			ID:                  uuid.New(),
			Owner:               userID,
			Hash:                uuid.NewString(),
			WowLogID:            logGroupID,
			SizeBytes:           1000,
			MimeType:            "text/plain",
			CompressedSizeBytes: database.Int8(&compressedSize),
			CreatedAt:           database.Timestamptz(now),
			UpdatedAt:           database.Timestamptz(now),
		})
		require.NoError(t, err)

		_, err = db.InsertLogFile(ctx, database.InsertLogFileParams{
			ID:        uuid.New(),
			Owner:     userID,
			Hash:      uuid.NewString(),
			WowLogID:  logGroupID,
			SizeBytes: 200,
			MimeType:  "text/plain",
			CreatedAt: database.Timestamptz(now),
			UpdatedAt: database.Timestamptz(now),
		})
		require.NoError(t, err)

		user, err := db.GetUserByID(ctx, userID)
		require.NoError(t, err)
		require.Equal(t, int64(600), user.ConsumedStorageBytes)
	})

	t.Run("CountUserPanelLayoutsTotal includes owned and tracked", func(t *testing.T) {
		t.Parallel()
		ctx := testutil.Context(t, testutil.WaitShort)

		ownerID := uuid.New()
		trackerID := uuid.New()
		_, err := db.InsertUser(ctx, database.InsertUserParams{ID: ownerID, Username: "layout-owner"})
		require.NoError(t, err)
		_, err = db.InsertUser(ctx, database.InsertUserParams{ID: trackerID, Username: "layout-tracker"})
		require.NoError(t, err)

		layoutID := uuid.New()
		_, err = db.CreateUserPanelLayout(ctx, database.CreateUserPanelLayoutParams{
			ID:          layoutID,
			UserID:      uuid.NullUUID{UUID: ownerID, Valid: true},
			Title:       "Owner Layout",
			Icon:        "INV_Misc_Book_09",
			Description: "owned",
			Payload:     []byte(`{"items":[]}`),
		})
		require.NoError(t, err)

		_, err = db.TrackUserPanelLayout(ctx, database.TrackUserPanelLayoutParams{
			UserID:   trackerID,
			LayoutID: layoutID,
		})
		require.NoError(t, err)

		ownerTotal, err := db.CountUserPanelLayoutsTotal(ctx, uuid.NullUUID{UUID: ownerID, Valid: true})
		require.NoError(t, err)
		require.Equal(t, int32(1), ownerTotal)

		trackerTotal, err := db.CountUserPanelLayoutsTotal(ctx, uuid.NullUUID{UUID: trackerID, Valid: true})
		require.NoError(t, err)
		require.Equal(t, int32(1), trackerTotal)
	})

	t.Run("YoutubeTimestamped slug upsert and reattach", func(t *testing.T) {
		t.Parallel()
		ctx := testutil.Context(t, testutil.WaitShort)

		pool, _ := dbtestutil.NewPGXPool(t)
		store := database.New(pool)

		// Helper to create an instance with optional slug.
		createInstance := func(t *testing.T, slug string) uuid.UUID {
			t.Helper()
			userID := uuid.New()
			_, err := store.InsertUser(ctx, database.InsertUserParams{ID: userID, Username: "u-" + uuid.NewString()[:8]})
			require.NoError(t, err)

			now := time.Now()
			logGroupID := uuid.New()
			_, err = store.InsertWoWLogGroup(ctx, database.InsertWoWLogGroupParams{
				ID: logGroupID, Owner: userID, LogType: database.LogTypeV1,
				CreatedAt: database.Timestamptz(now), UpdatedAt: database.Timestamptz(now),
			})
			require.NoError(t, err)
			err = store.InsertParsedLogGroup(ctx, logGroupID)
			require.NoError(t, err)

			// Insert server + realm directly (no generated query).
			serverID := uuid.New()
			realmID := uuid.New()
			_, err = pool.Exec(ctx,
				"INSERT INTO wow_servers (id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING",
				serverID, "test-server")
			require.NoError(t, err)
			_, err = pool.Exec(ctx,
				"INSERT INTO wow_server_realms (id, server_id, name) VALUES ($1, $2, $3)",
				realmID, serverID, "test-realm")
			require.NoError(t, err)

			var hashedSlug pgtype.Text
			if slug != "" {
				hashedSlug = pgtype.Text{String: slug, Valid: true}
			}
			inst, err := store.InsertInstance(ctx, database.InsertInstanceParams{
				ID: uuid.New(), RealmID: realmID, LogGroupID: logGroupID,
				Name: "test-instance", HashedSlug: hashedSlug,
				Capabilities: []string{},
			})
			require.NoError(t, err)
			return inst.ID
		}

		insertVideo := func(instanceID uuid.UUID, slug pgtype.Text, url string) {
			err := store.DeleteYoutubeVideoByInstanceOrSlug(ctx, database.DeleteYoutubeVideoByInstanceOrSlugParams{
				LogInstanceID: uuid.NullUUID{UUID: instanceID, Valid: true},
				InstanceSlug:  slug,
			})
			require.NoError(t, err)
			err = store.InsertStampedYoutubeVideo(ctx, database.InsertStampedYoutubeVideoParams{
				LogInstanceID: uuid.NullUUID{UUID: instanceID, Valid: true},
				InstanceSlug:  slug,
				CreatedAt:     database.Timestamptz(time.Now()),
				ExportedAt:    database.Timestamptz(time.Now()),
				VideoUrl:      url,
				Payload:       []database.VideoTimestamp{},
			})
			require.NoError(t, err)
		}

		getVideo := func(instanceID uuid.UUID, slug pgtype.Text) database.LogInstanceYoutubeTimestamped {
			v, err := store.GetInstanceYoutubeData(ctx, database.GetInstanceYoutubeDataParams{
				LogInstanceID: uuid.NullUUID{UUID: instanceID, Valid: true},
				InstanceSlug:  slug,
			})
			require.NoError(t, err)
			return v
		}

		t.Run("two instances without slugs get separate videos", func(t *testing.T) {
			id1 := createInstance(t, "")
			id2 := createInstance(t, "")

			insertVideo(id1, pgtype.Text{}, "https://yt.com/no-slug-1")
			insertVideo(id2, pgtype.Text{}, "https://yt.com/no-slug-2")

			v1 := getVideo(id1, pgtype.Text{})
			assert.Equal(t, "https://yt.com/no-slug-1", v1.VideoUrl)

			v2 := getVideo(id2, pgtype.Text{})
			assert.Equal(t, "https://yt.com/no-slug-2", v2.VideoUrl)
		})

		t.Run("upsert by slug overwrites existing video", func(t *testing.T) {
			slug := pgtype.Text{String: "slug-upsert-" + uuid.NewString()[:8], Valid: true}
			id1 := createInstance(t, slug.String)

			insertVideo(id1, slug, "https://yt.com/first")
			insertVideo(id1, slug, "https://yt.com/second")

			v := getVideo(id1, slug)
			assert.Equal(t, "https://yt.com/second", v.VideoUrl)
		})

		t.Run("upsert by instance_id overwrites when no slug", func(t *testing.T) {
			id1 := createInstance(t, "")

			insertVideo(id1, pgtype.Text{}, "https://yt.com/v1")
			insertVideo(id1, pgtype.Text{}, "https://yt.com/v2")

			v := getVideo(id1, pgtype.Text{})
			assert.Equal(t, "https://yt.com/v2", v.VideoUrl)
		})
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
