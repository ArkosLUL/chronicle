package storage

import (
	"fmt"
	"io"

	storage_go "github.com/supabase-community/storage-go"
)

type FileOptions = storage_go.FileOptions
type UrlOptions = storage_go.UrlOptions
type BucketOptions = storage_go.BucketOptions
type FileUploadResponse = storage_go.FileUploadResponse
type Bucket = storage_go.Bucket
type MessageResponse = storage_go.MessageResponse

var _ ObjectStorage = (*storage_go.Client)(nil)

type ObjectStorage interface {
	UploadFile(bucketId string, relativePath string, data io.Reader, fileOptions ...FileOptions) (FileUploadResponse, error)
	DownloadFile(bucketId string, filePath string, urlOptions ...UrlOptions) ([]byte, error)
	RemoveFile(bucketId string, paths []string) ([]FileUploadResponse, error)
	CreateBucket(id string, options BucketOptions) (Bucket, error)
	DeleteBucket(id string) (MessageResponse, error)
	EmptyBucket(id string) (MessageResponse, error)
	MoveFile(bucketId string, sourceKey string, destinationKey string) (FileUploadResponse, error)
	ListBuckets() ([]Bucket, error)
}

func Supabase(projectID, projectAPIKey string) (ObjectStorage, error) {
	storageClient := storage_go.NewClient(fmt.Sprintf("https://%s.supabase.co/storage/v1", projectID), projectAPIKey, nil)

	_, err := storageClient.ListBuckets()
	if err != nil {
		return nil, fmt.Errorf("test connection to storage service: %w", err)
	}

	return storageClient, nil
}
