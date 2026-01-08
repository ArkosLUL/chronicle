package raidlogs

import (
	"log/slog"

	"github.com/Emyrk/chronicle/database"
	"github.com/Emyrk/chronicle/database/storage"
)

const (
	BucketRaidLogs  = "raidlogs"
	BucketTemporary = "temporary"
)

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

	const raidLogLimit = "100mb"
	raidLogMimes := []string{"text/plain"}
	_, err := rl.Storage.CreateBucket(BucketRaidLogs, storage.BucketOptions{
		Public:           false,
		FileSizeLimit:    raidLogLimit,
		AllowedMimeTypes: raidLogMimes,
	})
	if err != nil {
		return nil, err
	}

	_, err = rl.Storage.CreateBucket(BucketTemporary, storage.BucketOptions{
		Public:           false,
		FileSizeLimit:    raidLogLimit,
		AllowedMimeTypes: raidLogMimes,
	})
	if err != nil {
		return nil, err
	}

	return rl, nil
}
