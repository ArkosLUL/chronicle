package character

import (
	"github.com/Emyrk/chronicle/combatlog/parser/guid"
)

const (
	sorcererThane        = 57642
	imageOfSorcererThane = 57643
)

func NewSorcererThaneCharacter(id guid.GUID, all *Characters) (Character, bool) {
	return NewAdsGoWithBoss(sorcererThane, imageOfSorcererThane)(id, all)
}
