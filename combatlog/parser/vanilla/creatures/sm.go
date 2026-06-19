package creatures

import (
	"time"

	"github.com/Emyrk/chronicle/combatlog/parser/common/characters"
	"github.com/Emyrk/chronicle/combatlog/parser/guid"
)

func NewVanillaPlusSMSoul(id guid.GUID, all *characters.Characters) (characters.Character, bool) {
	if entry, ok := id.GetEntry(); !ok || entry != 25246 {
		return nil, false
	}

	return characters.NewNeverActive(id), true
}

func NewVanillaPlusSMSoulHunter(id guid.GUID, all *characters.Characters) (characters.Character, bool) {
	if entry, ok := id.GetEntry(); !ok || entry != 25245 {
		return nil, false
	}

	c := characters.NewCommonCharacter(id, all)
	c.WithTimeoutAsDeath()
	c.WithTimeout(time.Second * 30)
	return c, true
}

func NewVanillaPlusBrotherMicheal(id guid.GUID, all *characters.Characters) (characters.Character, bool) {
	return characters.NewAdsGoWithBoss(25221, 25245)(id, all)
}

func NewVanillaPlusScarletCharger(id guid.GUID, all *characters.Characters) (characters.Character, bool) {
	return characters.NewDeathOnCast(35876, 25235, 25237)(id, all)
}

func NewVanillaPlusScarletSorcerer(id guid.GUID, all *characters.Characters) (characters.Character, bool) {
	// Seemingly cast polymorph on each other?
	return characters.NewIgnoreCast(25208,
		36158, // Polymorph Emote
		36157, // Polymorph CD
		36159, // Polymorph
	)(id, all)
}

func NewVanillaPlusScarletSharpshooter(id guid.GUID, all *characters.Characters) (characters.Character, bool) {
	if entry, ok := id.GetEntry(); !ok || entry != 25233 {
		return nil, false
	}

	// TODO: Figure these out better
	c := characters.NewCommonCharacter(id, all)
	c.WithTimeoutAsDeath()
	c.WithTimeout(time.Second * 30)
	return c, true
}
