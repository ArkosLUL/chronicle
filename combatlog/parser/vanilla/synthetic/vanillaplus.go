package synthetic

import (
	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
)

type vanillaplus struct {
	rag guid.GUID
	mag guid.GUID
}

func newVanillaPlus() *vanillaplus {
	return &vanillaplus{}
}

func (v *vanillaplus) ProcessMessages(msg []messages.Message) {
	for _, m := range msg {
		switch ty := m.(type) {
		case *messages.Unit:
			entry, ok := ty.Guid.GetEntry()
			if !ok {
				continue
			}
			switch entry {
			case 11502: // Ragnaros
				v.rag = ty.Guid
			case 11982:
				v.mag = ty.Guid
			}
		case *messages.Damage:
			if ty.Caster == nil {
				continue
			}
			if ent, ok := ty.Caster.GetEntry(); ent == 40004 && ok {
				switch ent {
				case 40004:
					// Fake Rag that casts spells for mag
					ty.Caster = &v.rag
				case 20006:
					// Fake Magmadar
					ty.Caster = &v.mag
				}
			}
		}
	}
}
