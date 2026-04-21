package synthetic

import (
	"context"
	"time"

	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/Emyrk/chronicle/combatlog/parser/types"
	"github.com/Emyrk/chronicle/combatlog/parser/types/combatant"
	"github.com/Emyrk/chronicle/combatlog/parser/types/unitinfo"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
	"github.com/Emyrk/chronicle/database/gamedb"
)

const (
	unitInfoCooldown = time.Minute * 10
)

type unitInfo struct {
	ctx       context.Context
	lastEmit  map[guid.GUID]time.Time
	creatures gamedb.CreatureFetcher
	names     NameResolver
}

func newUnitInfo(ctx context.Context, fetcher gamedb.CreatureFetcher, names NameResolver) *unitInfo {
	return &unitInfo{
		ctx:       ctx,
		lastEmit:  make(map[guid.GUID]time.Time),
		creatures: fetcher,
		names:     names,
	}
}

func (z *unitInfo) ProcessMessages(msgs []messages.Message) []messages.Message {
	var add []messages.Message
	for _, msg := range msgs {
		for _, c := range msg.Affects() {
			if !z.check(c, msg.Date()) {
				continue
			}

			if c.IsPlayer() {
				name, ok := z.names.Get(c)
				if !ok {
					continue
				}
				add = append(add, &messages.Combatant{
					MessageBase: messages.Base(msg.Date()),
					Combatant: combatant.Combatant{
						Name:       name,
						Guid:       c,
						Seen:       msg.Date(),
						HeroClass:  types.HeroClassesUNKNOWN,
						Gender:     types.HeroGenderUnknown,
						Race:       types.HeroRacesUnknown,
						PetName:    "",
						Guild:      nil,
						GearSetups: nil,
						Talents:    nil,
					},
				})
				continue
			}

			entry, ok := c.GetEntry()
			if !ok {
				continue
			}

			name, ok := z.names.Get(c)
			if !ok {
				cre, ok := z.creatures.Creature(int32(entry))
				if !ok {
					continue
				}
				name = cre.Name
			}

			add = append(add, &messages.Unit{
				MessageBase: messages.Base(msg.Date()),
				Info: unitinfo.Info{
					Seen:         msg.Date(),
					Guid:         c,
					IsPlayer:     false,
					Name:         name,
					CanCooperate: false,
					Owner:        nil,
				},
			})
		}
	}

	if len(add) > 0 {
		return append(add, msgs...)
	}
	return msgs
}

func (c *unitInfo) check(guid guid.GUID, now time.Time) bool {
	if last, ok := c.lastEmit[guid]; ok {
		if now.Sub(last) < unitInfoCooldown {
			return false
		}
	}

	c.lastEmit[guid] = now
	return true
}
