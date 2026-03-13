package database

import (
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

func FailedUpsertPlayersBatchResults() *UpsertPlayersBatchResults {
	return &UpsertPlayersBatchResults{
		br:     &failedBatch{},
		tot:    0,
		closed: false,
	}
}

var _ pgx.BatchResults = (*failedBatch)(nil)

type failedBatch struct {
}

func (f failedBatch) Exec() (pgconn.CommandTag, error) {
	return pgconn.CommandTag{}, errors.New("batch failed to start")
}

func (f failedBatch) Query() (pgx.Rows, error) {
	return nil, errors.New("batch failed to start")
}

func (f failedBatch) QueryRow() pgx.Row {
	return nil
}

func (f failedBatch) Close() error {
	return errors.New("batch failed to close")
}
