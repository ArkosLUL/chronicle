package synthetic

import (
	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/Emyrk/chronicle/combatlog/parser/types/combatant"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
)

type knownArmor struct {
	previous map[guid.GUID][]combatant.GearItem
}

func newKnownArmor() *knownArmor {
	return &knownArmor{}
}

func (r *knownArmor) ProcessMessages(msg []messages.Message) {
KnownArmorLoop:
	for _, m := range msg {
		switch ty := m.(type) {
		case *messages.Combatant:
			previous, ok := r.previous[ty.Guid]
			if ok {
				for _, item := range ty.GearSetups {
					if item.ItemID != 0 {
						r.previous[ty.Guid] = ty.GearSetups
						continue KnownArmorLoop
					}
					break
				}
				ty.GearSetups = previous
			}
		}
	}
}
