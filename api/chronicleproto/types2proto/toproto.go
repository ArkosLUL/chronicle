package types2proto

import (
	"github.com/Emyrk/chronicle/api/chronicleproto"
	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/Emyrk/chronicle/combatlog/parser/types"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
	"github.com/Emyrk/chronicle/internal/slice"
)

func Damage(idx int32, dmg messages.Damage) *chronicleproto.Damage {
	return &chronicleproto.Damage{
		Meta: &chronicleproto.EventMeta{
			Index:       idx,
			OffsetMilli: dmg.Timestamp.UnixMilli(),
		},
		Caster:     OptionalGUID(dmg.Caster),
		SourceName: dmg.SourceName(),
		Target:     dmg.Target.String(),
		HitType:    HitType(dmg.HitType),
		Amount:     dmg.Amount,
		School:     School(dmg.School),
		Tailers:    slice.List(dmg.Trailer, TrailerEntry),
	}
}

func OptionalGUID(id *guid.GUID) *string {
	if id == nil {
		return nil
	}
	str := id.String()
	return &str
}

func TrailerEntry(t types.TrailerEntry) *chronicleproto.Tailer {
	return &chronicleproto.Tailer{
		Amount:  t.Amount,
		HitType: HitType(t.HitType),
	}
}

func HitType(hitType types.HitType) uint32 {
	return uint32(hitType)
}

func School(school types.School) chronicleproto.School {
	switch school {
	case types.NoneSchool:
		return chronicleproto.School_None
	case types.PhysicalSchool:
		return chronicleproto.School_Physical
	case types.HolySchool:
		return chronicleproto.School_Holy
	case types.FireSchool:
		return chronicleproto.School_Fire
	case types.NatureSchool:
		return chronicleproto.School_Nature
	case types.FrostSchool:
		return chronicleproto.School_Frost
	case types.ShadowSchool:
		return chronicleproto.School_Shadow
	case types.ArcaneSchool:
		return chronicleproto.School_Arcane
	default:
		return chronicleproto.School_Unknown
	}
}
