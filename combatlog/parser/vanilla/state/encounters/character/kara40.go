package character

import "github.com/Emyrk/chronicle/combatlog/parser/guid"

// NewDemonicEye is for a mechanic on Mephistroth. This eye goes after a player.
// Players cannot interact with it.
func NewDemonicEye(id guid.GUID, _ *Characters) (Character, bool) {
	if entry, ok := id.GetEntry(); !ok || entry != 93334 {
		return nil, false
	}

	return NeverActive{id: id}, true
}

func NewKruul(id guid.GUID, all *Characters) (Character, bool) {
	return NewAdsGoWithBoss(59991, 59990)(id, all)
}

func NewRupturanTheBroken(id guid.GUID, all *Characters) (Character, bool) {
	return NewAdsGoWithBoss(59961,
		59901, // Felheart
	)(id, all)
}

func NewMephistroth(id guid.GUID, all *Characters) (Character, bool) {
	return NewAdsGoWithBoss(93333,
		93335, // Nightmare Crawler
		93336, // Hellfire Doomguard
		93337, // Hellfire Imp
		93338, // Hellfury Shard
		93332, // Desolate Doomguard
		93334, // Demonic Eye
	)(id, all)
}

func NewEchoOfMedivh(id guid.GUID, all *Characters) (Character, bool) {
	return NewAdsGoWithBoss(61958,
		59995, // Unstoppable Infernal
	)(id, all)
}

func NewKing(id guid.GUID, all *Characters) (Character, bool) {
	return NewAdsGoWithBoss(59967,
		59972, // Pawn
		49015, // Withering Pawn
		59971, // Bishop
		49013, // Decaying Bishop"
		49012, // "Broken Rook",
		59970, // "Rook",
		59968, // "Knight",
		49014, // "Malfunctioning Knight",
		59969, // "Ghastly Horseman",
		59953, // "Queen",
	)(id, all)
}

func NewSanvTasDal(id guid.GUID, all *Characters) (Character, bool) {
	return NewAdsGoWithBoss(59981,
		59978, // "Draenei Netherwalker",
		59975, // "Rift-Lost Draenei",
		59980, // "Draenei Truthseeker",
		59977, // "Draenei Riftwalker",
		59976, // "Draenei Riftstalker",
	)(id, all)
}

func NewKeeperGnarlmoon(id guid.GUID, all *Characters) (Character, bool) {
	return NewAdsGoWithBoss(61939,
		59999, // Blood Raven
	)(id, all)
}

func NewAnomalus(id guid.GUID, all *Characters) (Character, bool) {
	if entry, ok := id.GetEntry(); !ok || entry != 61951 {
		return nil, false
	}

	return NewPermanentDeath(NewCommonCharacter(id, all)), true
}
