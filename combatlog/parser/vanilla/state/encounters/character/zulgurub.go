package character

import (
	"github.com/Emyrk/chronicle/combatlog/parser/guid"
)

const (
	highPriestessJeklik = 14517
	bloodSeekerBat      = 11368
)

func NewHighPriestessJeklik(id guid.GUID, all *Characters) (Character, bool) {
	return NewAdsGoWithBoss(highPriestessJeklik, bloodSeekerBat)(id, all)
}

const (
	highPriestMarli = 14510
	venomBrood      = 14532
)

func NewHighPriestMarli(id guid.GUID, all *Characters) (Character, bool) {
	return NewAdsGoWithBoss(highPriestMarli, venomBrood)(id, all)
}

const (
	highPriestArlokk = 14515
	zulianProwler    = 15101
)

func NewHighPriestArlokk(id guid.GUID, all *Characters) (Character, bool) {
	return NewAdsGoWithBoss(highPriestArlokk, zulianProwler)(id, all)
}

//type HighPriestThekalParty struct {
//	*Common
//	all *Characters
//}
//
//const (
//	highPriestThekal = 14599
//	zealotZath       = 11348
//	zealotLorKhan    = 11347
//)
//
//func NewHighPriestThekalParty(id guid.GUID, all *Characters) (Character, bool) {
//	if !id.IsCreature() {
//		return nil, false
//	}
//
//	entry, ok := id.GetEntry()
//	if !ok {
//		return nil, false
//	}
//
//	switch entry {
//	case zealotZath, zealotLorKhan, highPriestThekal:
//	// in the party!
//	default:
//		return nil, false
//	}
//
//	return &HighPriestThekalParty{
//		Common: NewCommonCharacter(id, all),
//		all:    all,
//	}, true
//}
//
//func (c *HighPriestThekalParty) Process(m messages.Message) error {
//	wasActive := c.IsActive()
//
//	err := c.Common.Process(m)
//	if err != nil {
//		return err
//	}
//
//	// If someone was slain, or this unit just became inactive, then tell
//	// Majordomo to do an activity check.
//	_, isSlain := m.(messages.Slain)
//	if isSlain || (wasActive && !c.IsActive()) {
//		c.processAddCheck(m)
//	}
//
//	return nil
//}
//
//func (c *HighPriestThekalParty) processAddCheck(m messages.Message) {
//
//	if !c.IsActive() {
//		return // Nothing to do if Majordomo is not active
//	}
//
//	elites := c.all.ByEntry[11664]  // Famewaker elite
//	healers := c.all.ByEntry[11663] // Flamewaker healer
//	if len(elites)+len(healers) != 8 {
//		return
//	}
//
//	for _, char := range elites {
//		if char.IsActive() {
//			return
//		}
//	}
//
//	for _, char := range healers {
//		if char.IsActive() {
//			return
//		}
//	}
//
//	c.Died("all_adds_dead", m)
//}
