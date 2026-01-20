package character

import (
	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
)

type AdsGoWithBoss struct {
	Character
	bossEntry uint32
	adds      []uint32

	all *Characters
}

func NewAdsGoWithBoss(bossEntry uint32, ads ...uint32) func(id guid.GUID, all *Characters) (Character, bool) {
	return func(id guid.GUID, all *Characters) (Character, bool) {
		if !id.IsCreature() {
			return nil, false
		}

		entry, ok := id.GetEntry()
		if !ok {
			return nil, false
		}

		if entry != bossEntry {
			return nil, false
		}

		return &AdsGoWithBoss{
			Character: NewCommonCharacter(id, all),
			bossEntry: bossEntry,
			adds:      ads,
			all:       all,
		}, true
	}
}

func NewAdsGoWithBossCustomCharacter(c Character, all *Characters, bossEntry uint32, ads ...uint32) *AdsGoWithBoss {
	return &AdsGoWithBoss{
		Character: c,
		bossEntry: bossEntry,
		adds:      ads,
		all:       all,
	}
}

type CanDie interface {
	Died(reason string, m messages.Message)
}

func (c *AdsGoWithBoss) Process(m messages.Message) error {
	wasActive := c.IsActive()

	err := c.Character.Process(m)
	if err != nil {
		return err
	}

	if wasActive && !c.IsActive() {
		for _, ad := range c.adds {
			for _, add := range c.all.ByEntry[ad] {
				if com, ok := add.(CanDie); ok {
					com.Died("linked_boss_inactive", m)
				}
			}
		}
	}

	return nil
}
