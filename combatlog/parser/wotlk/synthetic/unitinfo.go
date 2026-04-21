package synthetic

import (
	"context"
	"time"

	"github.com/Emyrk/chronicle/combatlog/parser/guid"
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
}

func newUnitInfo(ctx context.Context, fetcher gamedb.CreatureFetcher) *unitInfo {
	return &unitInfo{
		ctx:       ctx,
		lastEmit:  make(map[guid.GUID]time.Time),
		creatures: fetcher,
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
				continue // TODO: Combatant info
			}

			entry, ok := c.GetEntry()
			if !ok {
				continue
			}

			cre, ok := z.creatures.Creature(int32(entry))
			if !ok {
				continue
			}

			add = append(add, &messages.Unit{
				MessageBase: messages.Base(msg.Date()),
				Info: unitinfo.Info{
					Seen:         msg.Date(),
					Guid:         c,
					IsPlayer:     false,
					Name:         cre.Name,
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
