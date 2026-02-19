package synthetic

import (
	"log/slog"

	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
	"github.com/Emyrk/chronicle/database/gamedb"
)

// Synthetic processes the raw combat log events, and occasionally will insert
// or mutate synthetic events to help downstream consumers.
type Synthetic struct {
	logger     *slog.Logger
	slain      *slainDetective
	mitigation *mitigator
	wowDB      *gamedb.WoWDB
}

func New(logger *slog.Logger, wowDB *gamedb.WoWDB) *Synthetic {
	return &Synthetic{
		logger:     logger,
		slain:      newSlainDetective(),
		mitigation: newMitigator(logger, wowDB),
		wowDB:      wowDB,
	}
}

func (s *Synthetic) ProcessMessages(msgs []messages.Message) ([]messages.Message, error) {
	for i, msg := range msgs {
		msgs[i] = s.slain.ProcessMessage(msg)
	}

	return msgs, nil
}
