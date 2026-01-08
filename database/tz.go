package database

import (
	"time"

	"github.com/jackc/pgx/v5/pgtype"
)

func Timestamptz(t time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{
		Time:  t.UTC(),
		Valid: true,
	}
}
