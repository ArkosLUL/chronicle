package raidlogs

import (
	"log/slog"

	"github.com/Emyrk/chronicle/database"
	"github.com/Emyrk/chronicle/database/storage"
)

const bucketID = "raidlogs"

type RaidLogStorage struct {
	logger   *slog.Logger
	Database database.Store
	Storage  storage.ObjectStorage
}

func NewRaidLogStorage(logger *slog.Logger, db database.Store, s storage.ObjectStorage) (*RaidLogStorage, error) {
	rl := &RaidLogStorage{
		logger:   logger,
		Database: db,
		Storage:  s,
	}

	_, err := rl.Storage.CreateBucket(bucketID, storage.BucketOptions{
		Public:           false,
		FileSizeLimit:    "100mb",
		AllowedMimeTypes: []string{"text/plain"},
	})
	if err != nil {
		return nil, err
	}

	return rl, nil
}
