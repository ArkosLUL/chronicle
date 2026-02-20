package chronparser

import (
	"github.com/Emyrk/chronicle/combatlog/parser/types"
	"github.com/Emyrk/chronicle/internal/bitmask"
	"github.com/Emyrk/chronicle/internal/ptr"
)

type HitInfo bitmask.Bitmask32

func (h HitInfo) Has(flag HitInfo) bool {
	return h&flag == flag
}

const (
	HITINFO_NORMALSWING     HitInfo = 0
	HITINFO_UNK0            HitInfo = 1
	HITINFO_AFFECTS_VICTIM  HitInfo = 2
	HITINFO_LEFTSWING       HitInfo = 4 //       -- Off-hand attack
	HITINFO_UNK3            HitInfo = 8
	HITINFO_MISS            HitInfo = 16
	HITINFO_ABSORB          HitInfo = 32
	HITINFO_RESIST          HitInfo = 64
	HITINFO_CRITICALHIT     HitInfo = 128
	HITINFO_UNK8            HitInfo = 256
	HITINFO_UNK9            HitInfo = 8192
	HITINFO_GLANCING        HitInfo = 16384
	HITINFO_CRUSHING        HitInfo = 32768
	HITINFO_NOACTION        HitInfo = 65536
	HITINFO_SWINGNOHITSOUND HitInfo = 524288
)

type VictimState uint16

const (
	VICTIMSTATE_UNAFFECTED VictimState = 0 // -- Seen with HITINFO_MISS
	VICTIMSTATE_NORMAL     VictimState = 1
	VICTIMSTATE_DODGE      VictimState = 2
	VICTIMSTATE_PARRY      VictimState = 3
	VICTIMSTATE_INTERRUPT  VictimState = 4
	VICTIMSTATE_BLOCKS     VictimState = 5
	VICTIMSTATE_EVADES     VictimState = 6
	VICTIMSTATE_IS_IMMUNE  VictimState = 7
	VICTIMSTATE_DEFLECTS   VictimState = 8
)

func HitType(info HitInfo, state VictimState) types.HitType {
	// TODO: Handle blocks, evades, immunities, deflections
	var t types.HitType
	switch {
	case info.Has(HITINFO_CRITICALHIT):
		t |= types.HitTypeCrit
	case info.Has(HITINFO_GLANCING):
		t |= types.HitTypeGlancing
	case info.Has(HITINFO_CRUSHING):
		t |= types.HitTypeCrushing
	case info.Has(HITINFO_MISS):
		t |= types.HitTypeMiss
	case info.Has(HITINFO_RESIST):
		t |= types.HitTypeFullResist
	case info.Has(HITINFO_ABSORB):
		// TODO: Remove the concept of partial & full absorb
		t |= types.HitTypeFullAbsorb
	case info.Has(HITINFO_NOACTION):
		// TODO: ?
	case info.Has(HITINFO_AFFECTS_VICTIM):
		t |= types.HitTypeHit
	default:
		t |= types.HitTypeHit
	}

	if info.Has(HITINFO_LEFTSWING) {
		t |= types.HitTypeOffHand
	}

	switch state {
	case VICTIMSTATE_UNAFFECTED:
		t |= types.HitTypeMiss // With the info miss
	case VICTIMSTATE_DODGE:
		t |= types.HitTypeDodge
	case VICTIMSTATE_BLOCKS:
		t |= types.HitTypeFullBlock // TODO: Remove the concept of partial & full block
	case VICTIMSTATE_DEFLECTS:
		t |= types.HitTypeDeflect
	case VICTIMSTATE_EVADES:
		t |= types.HitTypeEvade
	case VICTIMSTATE_IS_IMMUNE:
		t |= types.HitTypeImmune
	case VICTIMSTATE_PARRY:
		t |= types.HitTypeParry
	case VICTIMSTATE_INTERRUPT:
		// TODO: ?
	case VICTIMSTATE_NORMAL:
		// TODO: ?
	}

	return t
}

func Trailer(blocked, absorbed, resisted int32) types.Trailer {
	if blocked == 0 && resisted == 0 && absorbed == 0 {
		return nil
	}
	t := make(types.Trailer, 0)
	if blocked > 0 {
		t = append(t, BlockTrailer(blocked))
	}
	if resisted > 0 {
		t = append(t, Resisted(resisted))
	}
	if absorbed > 0 {
		t = append(t, Absorbed(absorbed))
	}
	return t
}

func BlockTrailer(blocked int32) types.TrailerEntry {
	return types.TrailerEntry{
		Amount:  ptr.Ref(uint32(blocked)),
		HitType: types.HitTypePartialBlock,
	}
}

func Resisted(resisted int32) types.TrailerEntry {
	return types.TrailerEntry{
		Amount:  ptr.Ref(uint32(resisted)),
		HitType: types.HitTypePartialResist,
	}
}

func Absorbed(absorbed int32) types.TrailerEntry {
	return types.TrailerEntry{
		Amount:  ptr.Ref(uint32(absorbed)),
		HitType: types.HitTypePartialAbsorb,
	}
}
