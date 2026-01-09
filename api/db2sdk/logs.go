package db2sdk

import (
	"github.com/Emyrk/chronicle/api/chroniclesdk"
	"github.com/Emyrk/chronicle/database"
	"github.com/Emyrk/chronicle/internal/slice"
)

func WoWLogGroupRow(group database.GetWoWLogGroupsByOwnerRow) chroniclesdk.WoWLogGroup {
	return chroniclesdk.WoWLogGroup{
		ID:        group.WoWLogGroup.ID,
		Owner:     group.WoWLogGroup.Owner,
		CreatedAt: group.WoWLogGroup.CreatedAt,
		UpdatedAt: group.WoWLogGroup.UpdatedAt,
		Files:     slice.List(group.Files, WoWLogFile),
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
