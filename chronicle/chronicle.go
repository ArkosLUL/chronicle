package chronicle

import (
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/Emyrk/chronicle/api/chronauth"
	"github.com/Emyrk/chronicle/api/chroniclesdk"
	"github.com/Emyrk/chronicle/api/db2sdk"
	"github.com/Emyrk/chronicle/api/httpapi"
	"github.com/Emyrk/chronicle/chronicle/riverqueue"
	"github.com/Emyrk/chronicle/database"
	"github.com/Emyrk/chronicle/database/authz"
	"github.com/Emyrk/chronicle/database/gamedb"
	"github.com/Emyrk/chronicle/database/storage"
	"github.com/Emyrk/chronicle/internal/cleanup"
	"github.com/Emyrk/chronicle/internal/ptr"
	"github.com/dustin/go-humanize"
	"github.com/google/uuid"
	"github.com/prometheus/client_golang/prometheus"
)

// UploadInput represents a file to be uploaded, potentially gzip-compressed.
type UploadInput struct {
	// Reader provides the raw file data (compressed if IsGzipped is true)
	Reader io.Reader
	// IsGzipped indicates whether the data is gzip-compressed
	IsGzipped bool
}

const (
	BucketRaidLogs  = "raidlogs"
	BucketTemporary = "temporary"
)

type Chronicle struct {
	AppContext         context.Context
	Storage            storage.ObjectStorage
	logger             *slog.Logger
	TemporaryDirectory string
	queue              *riverqueue.Queues
	Zed                *authz.Authz
	WoWDB              *gamedb.WoWDB
	metrics            *logParseMetrics

	mu sync.Mutex
}

type Options struct {
	Storage  storage.ObjectStorage
	Zed      *authz.Authz
	WoWDB    *gamedb.WoWDB
	Registry prometheus.Registerer
}

func New(ctx context.Context, logger *slog.Logger, opts Options) (*Chronicle, error) {
	c := &Chronicle{
		AppContext:         ctx,
		Storage:            opts.Storage,
		Zed:                opts.Zed,
		logger:             logger,
		WoWDB:              opts.WoWDB,
		TemporaryDirectory: filepath.Join(os.TempDir(), "chronicle_uploads"),
		metrics:            newLogParseMetrics(opts.Registry),
	}

	err := c.initStorage(ctx)
	if err != nil {
		return nil, fmt.Errorf("init storage: %w", err)
	}

	_ = c.clearTemporaryFiles()
	return c, nil
}

func (c *Chronicle) SetQueue(queue *riverqueue.Queues) {
	c.queue = queue
}

func (c *Chronicle) logPath(fileID uuid.UUID) string {
	return filepath.Join("logs", fileID.String())
}

func (c *Chronicle) initStorage(ctx context.Context) error {
	raidLogMimes := []string{"text/plain", "text/plain;charset=UTF-8"}
	_, err := c.Storage.CreateBucket(ctx, BucketRaidLogs, storage.BucketOptions{
		Public:           false,
		AllowedMimeTypes: raidLogMimes,
	})
	if err != nil && err.Error() != "The resource already exists" {
		return err
	}

	_, err = c.Storage.CreateBucket(ctx, BucketTemporary, storage.BucketOptions{
		Public:           false,
		AllowedMimeTypes: raidLogMimes,
	})
	if err != nil && err.Error() != "The resource already exists" {
		return err
	}
	return nil
}

func (c *Chronicle) UploadLogs(ctx context.Context, one, two UploadInput) (*database.WoWLogGroup, []database.LogFile, error) {
	clean := cleanup.New()
	defer clean.Do()

	now := time.Now()
	cl, ok := chronauth.AuthenticatedClaims(ctx)
	if !ok {
		return nil, nil, fmt.Errorf("upload file, no authenticated user")
	}

	user, err := c.Zed.GetUserByID(ctx, cl.Subject)
	if err != nil {
		return nil, nil, fmt.Errorf("fetch user: %w", err)
	}
	if user.ConsumedStorageBytes > user.MaxStorageBytes.Int64 {
		return nil, nil, httpapi.NewAPIError(
			fmt.Errorf("storage limit exceeded"),
			fmt.Sprintf("Reached storage limit of %s bytes, delete log files to free up space", humanize.Bytes(uint64(user.MaxStorageBytes.Int64))),
			http.StatusBadRequest)
	}

	// Save the files locally to disk first, then upload them to object storage.
	// This allows us to hash them and store in the database first, and keep them tracked.
	tmpIDs := []uuid.UUID{uuid.New(), uuid.New()}

	//nolint:errcheck
	defer c.clearTemporaryFiles()
	c.mu.Lock()
	defer c.mu.Unlock()
	inputs := []UploadInput{one, two}
	hashes := make([]string, 0, len(tmpIDs))
	tmpFiles := make([]*os.File, 0, len(tmpIDs))
	dbFiles := make([]database.LogFile, 0, len(tmpIDs))
	// Track file metadata for each upload
	type fileMeta struct {
		originalSize   int64
		compressedSize *int64 // nil if not compressed
		contentEnc     *string
	}
	fileMetas := make([]fileMeta, 0, len(tmpIDs))

	for i, tmp := range tmpIDs {
		input := inputs[i]
		tmpPath := filepath.Join(c.TemporaryDirectory, tmp.String())
		f, err := os.Create(tmpPath)
		if err != nil {
			return nil, nil, fmt.Errorf("create temp file: %w", err)
		}
		//nolint:errcheck
		defer f.Close()
		tmpFiles = append(tmpFiles, f)

		var h = sha256.New()
		var meta fileMeta

		if input.IsGzipped {
			// For gzipped input: store compressed data but compute hash of
			// decompressed content for deduplication.

			// Write compressed data to temp file
			written, err := io.Copy(f, input.Reader)
			if err != nil {
				return nil, nil, fmt.Errorf("write compressed temp file: %w", err)
			}

			// Sync and seek back
			if err := f.Sync(); err != nil {
				return nil, nil, fmt.Errorf("flush temp file: %w", err)
			}
			if _, err := f.Seek(0, io.SeekStart); err != nil {
				return nil, nil, fmt.Errorf("seek temp file: %w", err)
			}

			// Decompress from temp file to compute hash of original content
			gzReader, err := gzip.NewReader(f)
			if err != nil {
				return nil, nil, fmt.Errorf("create gzip reader for hashing: %w", err)
			}

			// Count original bytes while hashing
			originalCounter := &countingWriter{w: io.Discard}
			hashWriter := io.MultiWriter(h, originalCounter)
			if _, err := io.Copy(hashWriter, gzReader); err != nil {
				_ = gzReader.Close()
				return nil, nil, fmt.Errorf("hash decompressed content: %w", err)
			}
			_ = gzReader.Close()

			// Seek back for storage upload
			if _, err := f.Seek(0, io.SeekStart); err != nil {
				return nil, nil, fmt.Errorf("seek temp file for upload: %w", err)
			}

			meta.originalSize = originalCounter.count
			meta.compressedSize = ptr.Ref(written)
			meta.contentEnc = ptr.Ref("gzip")
		} else {
			// Uncompressed: write to file and hash simultaneously
			writer := io.MultiWriter(f, h)
			if _, err := io.Copy(writer, input.Reader); err != nil {
				return nil, nil, fmt.Errorf("write temp file: %w", err)
			}

			if err := f.Sync(); err != nil {
				return nil, nil, fmt.Errorf("flush temp file: %w", err)
			}

			// Get file size
			info, err := f.Stat()
			if err != nil {
				return nil, nil, fmt.Errorf("stat temp file: %w", err)
			}

			// Reset so it can be read back
			if _, err := f.Seek(0, io.SeekStart); err != nil {
				return nil, nil, fmt.Errorf("seek temp file: %w", err)
			}

			meta.originalSize = info.Size()
			meta.compressedSize = nil
			meta.contentEnc = nil
		}

		hashes = append(hashes, hex.EncodeToString(h.Sum(nil)))
		fileMetas = append(fileMetas, meta)
	}

	if hashes[0] == hashes[1] {
		return nil, nil, fmt.Errorf("the same file was uploaded twice; please upload two different log files")
	}

	var group database.WoWLogGroup
	// tmpFiles and hashes are the files that were uploaded now on local disk.
	err = c.Zed.InTx(func(tx *authz.AuthzTX) error {
		// Insert the log group
		var err error
		group, err = tx.InsertWoWLogGroup(ctx, database.InsertWoWLogGroupParams{
			ID:        uuid.New(),
			Owner:     cl.Subject,
			CreatedAt: database.Timestamptz(now),
			UpdatedAt: database.Timestamptz(now),
		})
		if err != nil {
			return err
		}

		// Insert both files
		for i := range hashes {
			meta := fileMetas[i]

			dbFile, err := tx.InsertLogFile(ctx, database.InsertLogFileParams{
				ID:                  tmpIDs[i],
				Owner:               cl.Subject,
				Hash:                hashes[i],
				WowLogID:            group.ID,
				SizeBytes:           meta.originalSize,
				MimeType:            "text/plain;charset=UTF-8", // logs are only plaintext
				CompressedSizeBytes: database.Int8(meta.compressedSize),
				ContentEncoding:     database.Text(meta.contentEnc),
				CreatedAt:           database.Timestamptz(now),
				UpdatedAt:           database.Timestamptz(now),
			})
			if err != nil {
				if database.IsUniqueViolation(err, database.UniqueFilesUniqueOwnerHash) {
					return httpapi.NewAPIError(
						fmt.Errorf("file with same hash already exists"), // Hide the sql error
						"A log file with the same contents has already been uploaded by you",
						http.StatusBadRequest).
						CTA("Log files cannot be uploaded multiple times, delete the conflicting log upload or choose another one.").
						Link("Conflicting Log file", "/logs/file/"+hashes[i])
				}
				return err
			}
			dbFiles = append(dbFiles, dbFile)
		}

		return nil
	}, nil)
	if err != nil {
		return nil, nil, err
	}

	clean.Add(func() { _ = c.Zed.DeleteWoWLogGroup(ctx, group.ID) })

	// Now store the logs in object storage
	for i := range tmpIDs {
		meta := fileMetas[i]
		contentType := "text/plain;charset=UTF-8"
		if meta.contentEnc != nil {
			// Store as gzip with appropriate content type
			contentType = "application/gzip"
		}

		storageObject, err := c.Storage.UploadFile(ctx, BucketRaidLogs, c.logPath(tmpIDs[i]), tmpFiles[i], storage.FileOptions{
			ContentType: ptr.Ref(contentType),
		})
		if err != nil {
			return nil, nil, fmt.Errorf("upload log file to object storage: %w", err)
		}
		clean.Add(func() { _, _ = c.Storage.RemoveFile(ctx, BucketRaidLogs, []string{storageObject.Key}) })
	}

	res, err := c.EnqueueParseLog(ctx, group, false)
	if err != nil {
		return nil, nil, fmt.Errorf("enqueue log parse job: %w", err)
	}
	clean.Add(func() { _, _ = c.queue.JobDelete(ctx, res.Job.ID) })

	// All worked! Do not do any cleanup work
	clean.Clear()

	// Both files are now fully uploaded in the database and object storage
	return &group, dbFiles, nil
}

// countingWriter wraps a writer and counts bytes written
type countingWriter struct {
	w     io.Writer
	count int64
}

func (c *countingWriter) Write(p []byte) (n int, err error) {
	n, err = c.w.Write(p)
	c.count += int64(n)
	return
}

func (c *Chronicle) WoWLogGroup(ctx context.Context, groupID uuid.UUID) (*chroniclesdk.WoWLogGroupState, error) {
	group, err := c.Zed.GetWoWLogGroupByID(ctx, groupID)
	if err != nil {
		return nil, fmt.Errorf("fetch log group: %w", err)
	}

	list, err := c.ListLogGroupJobs(ctx, groupID)
	if err != nil {
		return nil, fmt.Errorf("fetch log parse jobs: %w", err)
	}

	if len(list.Jobs) == 0 {
		return nil, fmt.Errorf("no log parse job found for log group %s", groupID)
	}

	currentJob := list.Jobs[0]
	return &chroniclesdk.WoWLogGroupState{
		WoWLogGroup: db2sdk.WoWLogGroupRow(group),
		Status:      db2sdk.JobStatus(*currentJob),
	}, nil
}

func (c *Chronicle) DeleteWoWLogGroup(ctx context.Context, logID uuid.UUID) error {
	err := c.RemoveWoWLogFilesFromStorage(ctx, logID)
	if err != nil {
		return fmt.Errorf("remove log files from storage: %w", err)
	}

	err = c.Zed.DeleteWoWLogGroup(ctx, logID)
	if err != nil {
		return fmt.Errorf("delete log group: %w", err)
	}

	return nil
}

func (c *Chronicle) DeleteWoWLogGroupFiles(ctx context.Context, logID uuid.UUID) error {
	err := c.RemoveWoWLogFilesFromStorage(ctx, logID)
	if err != nil {
		return fmt.Errorf("remove log files from storage: %w", err)
	}

	_, err = c.Zed.DeleteWoWLogGroupFiles(ctx, database.DeleteWoWLogGroupFilesParams{
		StorageDeletedAt: database.Timestamptz(time.Now()),
		WowLogID:         logID,
	})
	if err != nil {
		return fmt.Errorf("delete log group files: %w", err)
	}

	return nil
}

func (c *Chronicle) RemoveWoWLogFilesFromStorage(ctx context.Context, logID uuid.UUID) error {
	files, err := c.Zed.GetWoWLogFilesByGroupID(ctx, logID)
	if err != nil {
		return fmt.Errorf("fetch log files: %w", err)
	}

	for _, file := range files {
		_, err := c.Storage.RemoveFile(ctx, BucketRaidLogs, []string{c.logPath(file.ID)})
		if err != nil {
			return fmt.Errorf("remove file: %w", err)
		}
	}
	return nil
}

func (c *Chronicle) Close() error {
	return c.clearTemporaryFiles()
}

func (c *Chronicle) clearTemporaryFiles() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	defer func() {
		_ = os.MkdirAll(c.TemporaryDirectory, 0755)
	}()
	return os.RemoveAll(c.TemporaryDirectory)
}
