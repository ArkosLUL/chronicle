package character

import "github.com/Emyrk/chronicle/combatlog/parser/guid"

func NewSolnius(id guid.GUID, all *Characters) (Character, bool) {
	return NewAdsGoWithBoss(60748,
		60747, // Erennius goes friendly on Solnius death
	)(id, all)
}
