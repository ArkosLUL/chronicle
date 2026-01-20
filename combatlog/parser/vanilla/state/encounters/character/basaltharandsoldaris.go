package character

import (
	"time"

	"github.com/Emyrk/chronicle/combatlog/parser/guid"
)

const (
	basalthar = 65020
	smoldaris = 65021
)

func NewSmoldarisBasaltharCharacter(id guid.GUID, all *Characters) (Character, bool) {
	if !id.IsCreature() {
		return nil, false
	}

	entry, ok := id.GetEntry()
	if !ok {
		return nil, false
	}

	if !(entry == basalthar || entry == smoldaris) {
		return nil, false
	}

	c := NewCommonCharacter(id, all)
	c.Base.SetRecentlySlainDuration(time.Second * 10)
	return NewAdsGoWithBossCustomCharacter(
		c,
		all,
		entry,
		smoldaris, basalthar,
	), true
}
