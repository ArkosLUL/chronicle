package character

import (
	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
)

type Incindis struct {
	*Common
	all *Characters
}

const (
	incindis          = 52145
	spawnOfIncindis   = 52148
	flameskinIncindis = 52149
	eggIncindis       = 52146
)

func NewIncindisCharacter(id guid.GUID, all *Characters) (Character, bool) {
	if !id.IsCreature() {
		return nil, false
	}

	entry, ok := id.GetEntry()
	if !ok {
		return nil, false
	}

	if entry != incindis {
		return nil, false
	}

	return &Incindis{
		Common: NewCommonCharacter(id, all),
		all:    all,
	}, true
}

func (c *Incindis) Process(m messages.Message) error {
	wasActive := c.IsActive()

	err := c.Common.Process(m)
	if err != nil {
		return err
	}

	if wasActive && !c.IsActive() {
		// Incindis went inactive, so kill off the ads that spawn
		for _, add := range c.all.ByEntry[spawnOfIncindis] {
			if com, ok := add.(*Common); ok {
				com.Died("incindis_inactive", m)
			}
		}
		for _, add := range c.all.ByEntry[eggIncindis] {
			if com, ok := add.(*Common); ok {
				com.Died("incindis_inactive", m)
			}
		}
		for _, add := range c.all.ByEntry[flameskinIncindis] {
			if com, ok := add.(*Common); ok {
				com.Died("incindis_inactive", m)
			}
		}
	}

	return nil
}
