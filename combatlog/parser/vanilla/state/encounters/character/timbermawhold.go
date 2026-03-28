package character

import "github.com/Emyrk/chronicle/combatlog/parser/guid"

func NewKarrsh(id guid.GUID, all *Characters) (Character, bool) {
	if entry, ok := id.GetEntry(); !ok || entry != 62934 {

	}
	return NewPermanentDeath(NewCommonCharacter(id, all)), true
}
