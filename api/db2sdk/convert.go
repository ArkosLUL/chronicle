package db2sdk

import (
	"github.com/Emyrk/chronicle/api/chroniclesdk"
	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/Emyrk/chronicle/combatlog/parser/types"
	"github.com/Emyrk/chronicle/database"
	"github.com/Emyrk/chronicle/internal/maps"
	"github.com/Emyrk/chronicle/internal/slice"
	"github.com/google/uuid"
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

func WowDecoratedInstance(instance database.LogInstance,
	units []database.LogInstanceUnit,
	players []database.LogInstancePlayer,
	encounters []database.LogInstanceEncounter,
	fights []database.LogInstanceEncounterHostile,
) chroniclesdk.WoWParsedInstance {
	return chroniclesdk.WoWParsedInstance{
		WoWInstance: WoWInstance(instance),
		Encounters:  slice.List(encounters, WoWEncounter),
		Hostiles: maps.MapFromSlice(fights, func(h database.LogInstanceEncounterHostile) uuid.UUID {
			return h.EncounterID
		}, func(h database.LogInstanceEncounterHostile) []chroniclesdk.WoWEncounterHostile {
			return slice.List(fights, WoWHostile)
		}),
		Units: maps.MapFromSlice(units, func(u database.LogInstanceUnit) guid.GUID { return u.UnitGuid }, func(u database.LogInstanceUnit) chroniclesdk.InstanceUnit {
			return chroniclesdk.InstanceUnit{
				Name:  u.Name,
				Owner: u.OwnerGuid,
				Entry: uint32(u.Entry),
			}
		}),
		Players: maps.MapFromSlice(players, func(u database.LogInstancePlayer) guid.GUID { return u.UnitGuid }, func(u database.LogInstancePlayer) chroniclesdk.InstancePlayer {
			return chroniclesdk.InstancePlayer{
				Name:  u.Name,
				Class: types.HeroClasses(u.Class),
				Race:  types.HeroRaces(u.Race),
			}
		}),
	}
}

func PeriodMoment(moment *database.PeriodMoment) *chroniclesdk.PeriodMoment {
	if moment == nil {
		return nil
	}
	return &chroniclesdk.PeriodMoment{
		Timestamp: moment.Timestamp,
		Reason:    moment.Reason,
	}
}

func ActivityPeriod(period database.Period) chroniclesdk.ActivityPeriod {
	return chroniclesdk.ActivityPeriod{
		Start:      PeriodMoment(period.Start),
		End:        PeriodMoment(period.End),
		LastActive: PeriodMoment(period.LastActive),
		Slain:      period.Slain,
	}
}

func WoWHostile(hostile database.LogInstanceEncounterHostile) chroniclesdk.WoWEncounterHostile {
	return chroniclesdk.WoWEncounterHostile{
		ID:      hostile.ID,
		Periods: slice.List(hostile.Periods, ActivityPeriod),
	}
}

func WoWEncounter(encounter database.LogInstanceEncounter) chroniclesdk.WoWEncounter {
	return chroniclesdk.WoWEncounter{
		ID:         encounter.ID,
		InstanceID: encounter.InstanceID,
		Boss:       encounter.Boss,
		Name:       encounter.Name,
		Kill:       encounter.Kill,
		Remaining:  encounter.Remaining,
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

func EncounterDamageSummary(summary database.LogInstanceEncounterDamageUnitSummary) chroniclesdk.EncounterDamageSummary {
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
