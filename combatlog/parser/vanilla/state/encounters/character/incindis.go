package character

import (
	"github.com/Emyrk/chronicle/combatlog/parser/guid"
)

const (
	incindis          = 52145
	spawnOfIncindis   = 52148
	flameskinIncindis = 52149
	eggIncindis       = 52146
)

func NewIncindisCharacter(id guid.GUID, all *Characters) (Character, bool) {
	return NewAdsGoWithBoss(incindis, spawnOfIncindis, flameskinIncindis, eggIncindis)(id, all)
}
