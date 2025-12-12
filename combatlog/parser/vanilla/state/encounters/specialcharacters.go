package encounters

import (
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/data/totems"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
)

func Totems(state *ActivePeriods, event messages.Message, act *Active) {
	tot, ok := totems.IsTotem(state.Me.ID)
	if !ok {
		return
	}

	act.MaxLifetime = event.Date().Add(tot.MaxDuration())
}
