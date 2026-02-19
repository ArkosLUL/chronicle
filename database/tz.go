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

// Int8 creates a pgtype.Int8 from a pointer. Returns invalid if nil.
func Int8(v *int64) pgtype.Int8 {
	if v == nil {
		return pgtype.Int8{Valid: false}
	}
	return pgtype.Int8{Int64: *v, Valid: true}
}

// Text creates a pgtype.Text from a pointer. Returns invalid if nil.
func Text(v *string) pgtype.Text {
	if v == nil {
		return pgtype.Text{Valid: false}
	}
	return pgtype.Text{String: *v, Valid: true}
}
