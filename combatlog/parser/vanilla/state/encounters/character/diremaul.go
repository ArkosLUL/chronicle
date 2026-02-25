package character

import "github.com/Emyrk/chronicle/combatlog/parser/guid"

func NewImmolthar(id guid.GUID, all *Characters) (Character, bool) {
	return NewAdsGoWithBoss(11496,
		14399, // Arcane Torrent
		14396, // Eye of Immol'thar
	)(id, all)
}
