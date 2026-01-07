package storage

import (
	"fmt"
	"io"

	storage_go "github.com/supabase-community/storage-go"
)

var _ ObjectStorage = (*storage_go.Client)(nil)

type ObjectStorage interface {
	UploadFile(bucketId string, relativePath string, data io.Reader, fileOptions ...storage_go.FileOptions) (storage_go.FileUploadResponse, error)
	DownloadFile(bucketId string, filePath string, urlOptions ...storage_go.UrlOptions) ([]byte, error)
	RemoveFile(bucketId string, paths []string) ([]storage_go.FileUploadResponse, error)
	CreateBucket(id string, options storage_go.BucketOptions) (storage_go.Bucket, error)
	DeleteBucket(id string) (storage_go.MessageResponse, error)
	EmptyBucket(id string) (storage_go.MessageResponse, error)
}

func Supabase(projectID, projectAPIKey string) (ObjectStorage, error) {
	storageClient := storage_go.NewClient("https://<project-reference-id>.supabase.co/storage/v1", "<project-secret-api-key>", nil)

	_, err := storageClient.ListBuckets()
	if err != nil {
		return nil, fmt.Errorf("test connection to storage service: %w", err)
	}
	return storageClient, nil
}
