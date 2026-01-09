package chronicle

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"hash"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/Emyrk/chronicle/api/chronauth"
	"github.com/Emyrk/chronicle/api/httpapi"
	"github.com/Emyrk/chronicle/database"
	"github.com/Emyrk/chronicle/database/raidlogs"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/riverqueue/river"
)

type Chronicle struct {
	AppContext         context.Context
	RaidLogs           *raidlogs.RaidLogStorage
	DB                 database.Store
	logger             *slog.Logger
	TemporaryDirectory string

	queue *river.Client[pgx.Tx]
	mu    sync.Mutex
}

type Options struct {
	RaidLogs *raidlogs.RaidLogStorage
	DB       database.Store

	Queue RiverQueueOptions
}

func New(ctx context.Context, logger *slog.Logger, opts Options) (*Chronicle, error) {
	c := &Chronicle{
		AppContext:         ctx,
		RaidLogs:           opts.RaidLogs,
		DB:                 opts.DB,
		logger:             logger,
		TemporaryDirectory: filepath.Join(os.TempDir(), "chronicle_uploads"),
	}

	// River async job queue
	err := c.StartQueues(ctx, opts)
	if err != nil {
		return nil, fmt.Errorf("start queues: %w", err)
	}

	_ = c.clearTemporaryFiles()
	return c, nil
}

func (c *Chronicle) UploadLogs(ctx context.Context, one, two io.Reader) (*database.WoWLog, error) {
	now := time.Now()
	cl, ok := chronauth.AuthenticatedClaims(ctx)
	if !ok {
		return nil, fmt.Errorf("upload file, no authenticated user")
	}

	// Save the files locally to disk first, then upload them to object storage.
	// This allows us to hash them and store in the database first, and keep them tracked.
	tmpIDs := []uuid.UUID{uuid.New(), uuid.New()}

	defer c.clearTemporaryFiles()
	c.mu.Lock()
	defer c.mu.Unlock()
	rdrs := []io.Reader{one, two}
	hashes := make([]string, 0, len(tmpIDs))
	tmpFiles := make([]*os.File, 0, len(tmpIDs))

	for i, tmp := range tmpIDs {
		rdr := rdrs[i]
		tmpPath := filepath.Join(c.TemporaryDirectory, tmp.String())
		f, err := os.Create(tmpPath)
		if err != nil {
			return nil, fmt.Errorf("create temp file: %w", err)
		}
		defer f.Close()
		tmpFiles = append(tmpFiles, f)

		var h hash.Hash = sha256.New()
		writer := io.MultiWriter(f, h)

		if _, err := io.Copy(writer, rdr); err != nil {
			return nil, fmt.Errorf("write temp file: %w", err)
		}

		err = tmpFiles[i].Sync()
		if err != nil {
			return nil, fmt.Errorf("flush temp file: %w", err)
		}

		// Reset so it can be read back
		_, err = tmpFiles[i].Seek(0, io.SeekStart)
		if err != nil {
			return nil, fmt.Errorf("seek temp file: %w", err)
		}

		hashes = append(hashes, hex.EncodeToString(h.Sum(nil)))
	}

	if hashes[0] == hashes[1] {
		return nil, fmt.Errorf("the same file was uploaded twice; please upload two different log files")
	}

	var log database.WoWLog
	// tmpFiles and hashes are the files that were uploaded now on local disk.
	err := c.DB.InTx(func(tx database.Store) error {
		// Insert both files
		dbFiles := make([]database.File, 0, len(hashes))
		for i, _ := range hashes {
			tmpFile := tmpFiles[i]
			info, err := tmpFile.Stat()
			if err != nil {
				return fmt.Errorf("stat temp file: %w", err)
			}

			dbFile, err := tx.InsertFile(ctx, database.InsertFileParams{
				ID:        tmpIDs[i],
				Owner:     cl.Subject,
				Hash:      hashes[i],
				SizeBytes: info.Size(),
				MimeType:  "text/plain", // logs are only plaintext
				CreatedAt: database.Timestamptz(now),
				UpdatedAt: database.Timestamptz(now),
			})
			if err != nil {
				if database.IsUniqueViolation(err, database.UniqueFilesUniqueOwnerHash) {
					return httpapi.NewAPIError(err,
						"A log file with the same contents has already been uploaded by you",
						http.StatusBadRequest).CTA("Log files cannot be uploaded multiple times, delete the conflicting file or choose another one.")
				}
				return err
			}
			dbFiles = append(dbFiles, dbFile)
		}

		// Insert the log entry
		var err error
		log, err = tx.InsertWowLog(ctx, database.InsertWowLogParams{
			ID:            uuid.New(),
			Owner:         cl.Subject,
			FirstLogFile:  dbFiles[0].ID,
			SecondLogFile: dbFiles[1].ID,
			CreatedAt:     database.Timestamptz(now),
			UpdatedAt:     database.Timestamptz(now),
		})
		if err != nil {
			return err
		}

		return nil
	}, nil)
	if err != nil {
		return nil, err
	}

	// Now store the logs in object storage
	for i := range tmpIDs {
		_, err := c.RaidLogs.Storage.UploadFile(raidlogs.BucketRaidLogs, filepath.Join("logs", tmpIDs[i].String()), tmpFiles[i])
		if err != nil {
			return nil, fmt.Errorf("upload log file to object storage: %w", err)
		}
	}

	// Both files are now fully uploaded in the database and object storage
	return &log, nil
}

func (c *Chronicle) Close() error {
	qerr := c.queue.Stop(c.AppContext)

	return errors.Join(qerr)
}

func (c *Chronicle) clearTemporaryFiles() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	defer func() {
		_ = os.MkdirAll(c.TemporaryDirectory, 0755)
	}()
	return os.RemoveAll(c.TemporaryDirectory)
}
