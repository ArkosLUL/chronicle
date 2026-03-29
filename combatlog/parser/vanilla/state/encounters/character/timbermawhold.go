package character

import "github.com/Emyrk/chronicle/combatlog/parser/guid"

func NewKarrsh(id guid.GUID, all *Characters) (Character, bool) {
	if entry, ok := id.GetEntry(); !ok || entry != 62934 {
		return nil, false
	}
	return NewPermanentDeath(NewCommonCharacter(id, all)), true
}

func NewChieftainPartath(id guid.GUID, all *Characters) (Character, bool) {
	return NewAdsGoWithBoss(62961,
		62942, // Illuminator
	)(id, all)
}

func NewOrmanos(id guid.GUID, all *Characters) (Character, bool) {
	return NewAdsGoWithBoss(62935,
		51608, // Tremor
	)(id, all)
}

func NewUrsol(id guid.GUID, all *Characters) (Character, bool) {
	return NewAdsGoWithBoss(62947,
		29481, // Ursan Horror
		29482, // Nightmare Fiend
	)(id, all)
}

func NewVileSkitterer(id guid.GUID, all *Characters) (Character, bool) {
	if entry, ok := id.GetEntry(); !ok || entry != 62874 {
		return nil, false
	}
	return NewPermanentDeath(NewCommonCharacter(id, all)), true
}
