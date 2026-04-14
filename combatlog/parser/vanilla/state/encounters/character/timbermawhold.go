package character

import "github.com/Emyrk/chronicle/combatlog/parser/guid"

func NewKarrsh(id guid.GUID, all *Characters) (Character, bool) {
	if entry, ok := id.GetEntry(); !ok || entry != 62934 {
		return nil, false
	}
	return NewPermanentDeath(NewCommonCharacter(id, all)), true
}

func NewSelenaxxFoulheart(id guid.GUID, all *Characters) (Character, bool) {
	return NewAdsGoWithBoss(62940,
		59816, // Corrupted Draenethyst Geode
	)(id, all)
}

func NewChieftainPartath(id guid.GUID, all *Characters) (Character, bool) {
	return NewAdsGoWithBoss(62941,
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

func NewNightmareFiend(id guid.GUID, all *Characters) (Character, bool) {
	if entry, ok := id.GetEntry(); !ok || entry != 29482 {
		return nil, false
	}
	return NewCommonCharacter(id, all).WithTimeoutAsDeath(), true
}

func NewVileSkitterer(id guid.GUID, all *Characters) (Character, bool) {
	if entry, ok := id.GetEntry(); !ok || entry != 62874 {
		return nil, false
	}
	return NewPermanentDeath(NewCommonCharacter(id, all)), true
}
