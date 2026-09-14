package creatures

import (
	"github.com/Emyrk/chronicle/combatlog/parser/common/characters"
	"github.com/Emyrk/chronicle/combatlog/parser/guid"
)

func NewFlameLeviathan(id guid.GUID, all *characters.Characters) (characters.Character, bool) {
	entry, ok := id.GetEntry()
	if !ok || (entry != 34003 && entry != 33113) {
		return nil, false
	}

	return characters.NewAdsGoWithBoss(entry, 33236, 34113)(id, all)
}
