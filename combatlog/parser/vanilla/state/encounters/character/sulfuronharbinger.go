package character

import (
	"github.com/Emyrk/chronicle/combatlog/parser/guid"
)

const (
	sulfuronHarbinger = 12098
	sonOfFlame        = 12143
)

func NewSulfuronHarbingerCharacter(id guid.GUID, all *Characters) (Character, bool) {
	return NewAdsGoWithBoss(sulfuronHarbinger, sonOfFlame)(id, all)
}
