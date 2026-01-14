package db2sdk

import (
	"github.com/Emyrk/chronicle/api/chroniclesdk"
	"github.com/Emyrk/chronicle/database"
	"github.com/Emyrk/chronicle/internal/slice"
	"github.com/riverqueue/river/rivertype"
)

// logGroupRow is an interface that matches both GetWoWLogGroupsByOwnerRow and GetWoWLogGroupByIDRow
type logGroupRow interface {
	GetWoWLogGroup() database.WoWLogGroup
	GetFiles() []database.LogFile
}

func (r wrapGetWoWLogGroupsByOwnerRow) GetWoWLogGroup() database.WoWLogGroup { return r.WoWLogGroup }
func (r wrapGetWoWLogGroupsByOwnerRow) GetFiles() []database.LogFile         { return r.Files }

type wrapGetWoWLogGroupsByOwnerRow database.GetWoWLogGroupsByOwnerRow

func (r wrapGetWoWLogGroupByIDRow) GetWoWLogGroup() database.WoWLogGroup { return r.WoWLogGroup }
func (r wrapGetWoWLogGroupByIDRow) GetFiles() []database.LogFile         { return r.Files }

type wrapGetWoWLogGroupByIDRow database.GetWoWLogGroupByIDRow

func WoWLogGroupRow[T database.GetWoWLogGroupsByOwnerRow | database.GetWoWLogGroupByIDRow](group T) chroniclesdk.WoWLogGroup {
	// Use type switch to handle both types
	switch g := any(group).(type) {
	case database.GetWoWLogGroupsByOwnerRow:
		return chroniclesdk.WoWLogGroup{
			ID:        g.WoWLogGroup.ID,
			Owner:     g.WoWLogGroup.Owner,
			CreatedAt: g.WoWLogGroup.CreatedAt,
			UpdatedAt: g.WoWLogGroup.UpdatedAt,
			Files:     slice.List(g.Files, WoWLogFile),
		}
	case database.GetWoWLogGroupByIDRow:
		return chroniclesdk.WoWLogGroup{
			ID:        g.WoWLogGroup.ID,
			Owner:     g.WoWLogGroup.Owner,
			CreatedAt: g.WoWLogGroup.CreatedAt,
			UpdatedAt: g.WoWLogGroup.UpdatedAt,
			Files:     slice.List(g.Files, WoWLogFile),
		}
	default:
		panic("unexpected type")
	}
}

func WoWLogFile(file database.LogFile) chroniclesdk.WoWLogFile {
	return chroniclesdk.WoWLogFile{
		ID:        file.ID,
		Owner:     file.Owner,
		WowLogID:  file.WowLogID,
		Hash:      file.Hash,
		SizeBytes: file.SizeBytes,
		MimeType:  file.MimeType,
		CreatedAt: file.CreatedAt,
		UpdatedAt: file.UpdatedAt,
	}
}

func JobStatus(status rivertype.JobRow) chroniclesdk.JobStatus {
	return chroniclesdk.JobStatus{
		ID:          status.ID,
		State:       status.State,
		ScheduledAt: status.ScheduledAt,
		AttemptedAt: status.AttemptedAt,
		CreatedAt:   status.CreatedAt,
		FinalizedAt: status.FinalizedAt,
		Errors:      status.Errors,
		Kind:        status.Kind,
	}
}
