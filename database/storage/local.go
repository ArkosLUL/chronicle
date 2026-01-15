package storage

import (
	"fmt"
	"io"
	"os"
	"path/filepath"

	storage_go "github.com/supabase-community/storage-go"
)

var _ ObjectStorage = (*LocalStorage)(nil)

// LocalStorage uses $HOME/.chronicle/storage as storage location for local files.
type LocalStorage struct {
	basePath string
}

func NewLocalStorage() (*LocalStorage, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("get home dir: %w", err)
	}
	basePath := filepath.Join(home, ".chronicle", "storage")
	if err := os.MkdirAll(basePath, 0755); err != nil {
		return nil, fmt.Errorf("create storage dir: %w", err)
	}
	return &LocalStorage{basePath: basePath}, nil
}

func (l *LocalStorage) bucketPath(bucketId string) string {
	return filepath.Join(l.basePath, bucketId)
}

func (l *LocalStorage) filePath(bucketId, relativePath string) string {
	return filepath.Join(l.basePath, bucketId, relativePath)
}

func (l *LocalStorage) UploadFile(bucketId string, relativePath string, data io.Reader, fileOptions ...storage_go.FileOptions) (storage_go.FileUploadResponse, error) {
	fullPath := l.filePath(bucketId, relativePath)
	if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
		return storage_go.FileUploadResponse{}, fmt.Errorf("create dir: %w", err)
	}

	f, err := os.Create(fullPath)
	if err != nil {
		return storage_go.FileUploadResponse{}, fmt.Errorf("create file: %w", err)
	}
	//nolint:errcheck
	defer f.Close()

	if _, err := io.Copy(f, data); err != nil {
		return storage_go.FileUploadResponse{}, fmt.Errorf("write file: %w", err)
	}

	return storage_go.FileUploadResponse{Key: filepath.Join(bucketId, relativePath)}, nil
}

func (l *LocalStorage) DownloadFile(bucketId string, filePath string, urlOptions ...storage_go.UrlOptions) ([]byte, error) {
	fullPath := l.filePath(bucketId, filePath)
	data, err := os.ReadFile(fullPath)
	if err != nil {
		return nil, fmt.Errorf("read file: %w", err)
	}
	return data, nil
}

func (l *LocalStorage) RemoveFile(bucketId string, paths []string) ([]storage_go.FileUploadResponse, error) {
	var responses []storage_go.FileUploadResponse
	for _, p := range paths {
		fullPath := l.filePath(bucketId, p)
		if err := os.Remove(fullPath); err != nil && !os.IsNotExist(err) {
			return responses, fmt.Errorf("remove file %s: %w", p, err)
		}
		responses = append(responses, storage_go.FileUploadResponse{Key: filepath.Join(bucketId, p)})
	}
	return responses, nil
}

func (l *LocalStorage) CreateBucket(id string, options storage_go.BucketOptions) (storage_go.Bucket, error) {
	bucketPath := l.bucketPath(id)
	if err := os.MkdirAll(bucketPath, 0755); err != nil {
		return storage_go.Bucket{}, fmt.Errorf("create bucket: %w", err)
	}
	return storage_go.Bucket{Id: id, Name: id}, nil
}

func (l *LocalStorage) DeleteBucket(id string) (storage_go.MessageResponse, error) {
	bucketPath := l.bucketPath(id)
	if err := os.RemoveAll(bucketPath); err != nil {
		return storage_go.MessageResponse{}, fmt.Errorf("delete bucket: %w", err)
	}
	return storage_go.MessageResponse{Message: "Bucket deleted"}, nil
}

func (l *LocalStorage) ListBuckets() ([]storage_go.Bucket, error) {
	entries, err := os.ReadDir(l.basePath)
	if err != nil {
		return nil, fmt.Errorf("read storage dir: %w", err)
	}
	var buckets []storage_go.Bucket
	for _, entry := range entries {
		if entry.IsDir() {
			buckets = append(buckets, storage_go.Bucket{Id: entry.Name(), Name: entry.Name()})
		}
	}
	return buckets, nil
}

func (l *LocalStorage) EmptyBucket(id string) (storage_go.MessageResponse, error) {
	bucketPath := l.bucketPath(id)
	entries, err := os.ReadDir(bucketPath)
	if err != nil {
		return storage_go.MessageResponse{}, fmt.Errorf("read bucket: %w", err)
	}
	for _, entry := range entries {
		if err := os.RemoveAll(filepath.Join(bucketPath, entry.Name())); err != nil {
			return storage_go.MessageResponse{}, fmt.Errorf("remove %s: %w", entry.Name(), err)
		}
	}
	return storage_go.MessageResponse{Message: "Bucket emptied"}, nil
}

func (l *LocalStorage) MoveFile(bucketId string, srcPath string, destPath string) (storage_go.FileUploadResponse, error) {
	src := l.filePath(bucketId, srcPath)
	dest := l.filePath(bucketId, destPath)

	if err := os.MkdirAll(filepath.Dir(dest), 0755); err != nil {
		return storage_go.FileUploadResponse{}, fmt.Errorf("create dest dir: %w", err)
	}

	if err := os.Rename(src, dest); err != nil {
		return storage_go.FileUploadResponse{}, fmt.Errorf("move file: %w", err)
	}

	return storage_go.FileUploadResponse{Key: filepath.Join(bucketId, destPath)}, nil
}
