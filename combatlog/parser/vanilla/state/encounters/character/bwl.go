package character

import (
	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
)

func NewRazorgore(id guid.GUID, all *Characters) (Character, bool) {
	if entry, ok := id.GetEntry(); !ok || entry != 12435 {
		return nil, false
	}

	return &razorgore{Common: NewCommonCharacter(id, all)}, true
}

type razorgore struct {
	*Common
}

func (c *razorgore) Process(m messages.Message) error {
	switch ty := m.(type) {
	case *messages.SpellGo:
		// Razorgore is MC'd and destroys eggs around the room. Count this as activity.
		if ty.Caster == c.ID() && ty.SpellData != nil &&
			(ty.SpellData.ID == 19873 || ty.SpellData.ID == 22425) {
			ty.MarkActivityStart("Razorgore destroying eggs")
		}
	}
	return c.Common.Process(m)
}

func NewShadowflameSpark(id guid.GUID, all *Characters) (Character, bool) {
	if entry, ok := id.GetEntry(); !ok || entry != 65151 {
		return nil, false
	}

	all.db.UpdateUnitName(id, "Shadowflame Spark")
	return &shadowflameSpark{Common: NewCommonCharacter(id, all), all: all}, true
}

type shadowflameSpark struct {
	*Common
	done bool
	all  *Characters
}

func (c *shadowflameSpark) Process(m messages.Message) error {
	if c.done {
		return nil
	}
	if c.IsActive() {
		// Sometimes the name does not get recorded. Summonables and all that :cry:
		c.all.db.UpdateUnitName(c.ID(), "Shadowflame Spark")
		ebonroc := c.all.ByEntry[14601]
		for _, char := range ebonroc {
			if char.IsActive() {
				c.all.db.UpdateOwner(c.ID(), char.ID())
			}
		}

		c.Died("sparks vanish and do not count", m)
		c.done = true
		return nil
	}
	return c.Common.Process(m)

}
