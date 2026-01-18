package db2sdk

import (
	"github.com/Emyrk/chronicle/api/chroniclesdk"
	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/Emyrk/chronicle/combatlog/parser/types"
	"github.com/Emyrk/chronicle/database"
	"github.com/Emyrk/chronicle/internal/maps"
	"github.com/Emyrk/chronicle/internal/slice"
	"github.com/riverqueue/river/rivertype"
)

func WoWLogGroupRow[T database.GetWoWLogGroupsByOwnerRow | database.GetWoWLogGroupByIDRow](group T) chroniclesdk.WoWLogGroup {
	// Use type switch to handle both types
	switch g := any(group).(type) {
	case database.GetWoWLogGroupsByOwnerRow:
		return chroniclesdk.WoWLogGroup{
			ID:               g.WoWLogGroup.ID,
			Owner:            g.WoWLogGroup.Owner,
			CreatedAt:        g.WoWLogGroup.CreatedAt,
			UpdatedAt:        g.WoWLogGroup.UpdatedAt,
			Files:            slice.List(g.Files, WoWLogFile),
			ProcessingOutput: g.ProcessingOutput,
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

func WoWInstance(instance database.LogInstance) chroniclesdk.WoWInstance {
	return chroniclesdk.WoWInstance{
		ID:         instance.ID,
		RealmID:    instance.RealmID,
		LogGroupID: instance.LogGroupID,
		Name:       instance.Name,
	}
}

func WowDecoratedInstance(instance database.LogInstance, units []database.InstanceUnit, players []database.InstancePlayer, encounters []database.LogEncounter) chroniclesdk.WoWParsedInstance {
	return chroniclesdk.WoWParsedInstance{
		WoWInstance: WoWInstance(instance),
		Encounters:  slice.List(encounters, WoWEncounter),
		Units: maps.MapFromSlice(units, func(u database.InstanceUnit) guid.GUID { return u.UnitGuid }, func(u database.InstanceUnit) chroniclesdk.InstanceUnit {
			return chroniclesdk.InstanceUnit{
				Name:  u.Name,
				Owner: u.OwnerGuid,
				Entry: uint32(u.Entry),
			}
		}),
		Players: maps.MapFromSlice(players, func(u database.InstancePlayer) guid.GUID { return u.UnitGuid }, func(u database.InstancePlayer) chroniclesdk.InstancePlayer {
			return chroniclesdk.InstancePlayer{
				Name:  u.Name,
				Class: types.HeroClasses(u.Class),
				Race:  types.HeroRaces(u.Race),
			}
		}),
	}
}

func WoWEncounter(encounter database.LogEncounter) chroniclesdk.WoWEncounter {
	return chroniclesdk.WoWEncounter{
		ID:         encounter.ID,
		InstanceID: encounter.InstanceID,
		Name:       encounter.Name,
		Kill:       encounter.Kill,
		Boss:       encounter.Boss,
		StartTime:  encounter.StartTime.Time,
		EndTime:    encounter.EndTime.Time,
	}
}

func JobStatus(status rivertype.JobRow) chroniclesdk.JobStatus {
	return chroniclesdk.JobStatus{
		ID:          status.ID,
		Attempt:     status.Attempt,
		MaxAttempts: status.MaxAttempts,
		State:       status.State,
		ScheduledAt: status.ScheduledAt,
		AttemptedAt: status.AttemptedAt,
		CreatedAt:   status.CreatedAt,
		FinalizedAt: status.FinalizedAt,
		Errors:      status.Errors,
		Kind:        status.Kind,
		Output:      status.Output(),
	}
}

func Ability(ability database.Ability) chroniclesdk.Ability {
	return chroniclesdk.Ability(ability)
}

func EncounterDamageSummary(summary database.EncounterDamageUnitSummary) chroniclesdk.EncounterDamageSummary {
	return chroniclesdk.EncounterDamageSummary{
		EncounterID:          summary.EncounterID,
		UnitGuid:             summary.UnitGuid,
		DamageDoneTotal:      summary.DamageDoneTotal,
		DamageTakenTotal:     summary.DamageTakenTotal,
		DamageDoneAbilities:  maps.Map(summary.DamageDoneAbilities, Ability),
		DamageTakenAbilities: maps.Map(summary.DamageTakenAbilities, Ability),
		IsPlayer:             summary.IsPlayer,
		OwnerGuid:            summary.OwnerGuid,
	}
}
