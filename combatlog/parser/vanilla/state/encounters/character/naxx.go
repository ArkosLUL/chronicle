package character

import "github.com/Emyrk/chronicle/combatlog/parser/guid"

func NewKelThuzad(id guid.GUID, all *Characters) (Character, bool) {
	return NewAdsGoWithBoss(
		15990, // Kel'Thuzad
		16441, // Guardian of Icecrown
	)(id, all)
}

func NewGluth(id guid.GUID, all *Characters) (Character, bool) {
	return NewAdsGoWithBoss(
		15932, // Gluth
		16360, // Zombie Chow
	)(id, all)
}

// NewGrobbulus -- Explodes on death
func NewGrobbulus(id guid.GUID, all *Characters) (Character, bool) {
	if !id.IsCreature() {
		return nil, false
	}
	if entry, ok := id.GetEntry(); !ok || entry != 15931 {
		return nil, false
	}
	return NewPermanentDeath(NewCommonCharacter(id, all)), true
}

// NewDiseasedMaggot is I think the blobs that crawl along the floor?
//func NewDiseasedMaggot(id guid.GUID, all *Characters) (Character, bool) {
//	if entry, ok := id.GetEntry(); !ok || entry != 16056 {
//		return nil, false
//	}
//
//	if !id.IsCreature() {
//		return nil, false
//	}
//
//	return &NeverActive{id: id}, true
//}

//type GothikTheHarvester struct {
//	*Common
//}
//
//func NewGothikTheHarvester(id guid.GUID, all *Characters) (Character, bool) {
//	if !id.IsCreature() {
//		return nil, false
//	}
//
//	if entry, ok := id.GetEntry(); !ok || entry != 16060 {
//		return nil, false
//	}
//
//	return &CoreHound{
//		Common: NewCommonCharacter(id, all),
//	}, true
//}
