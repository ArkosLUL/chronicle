package synthetic

import (
	"log/slog"

	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
)

// Synthetic processes the raw combat log events, and occasionally will insert
// or mutate synthetic events to help downstream consumers.
type Synthetic struct {
	logger *slog.Logger
	slain  *slainDetective
}

func New(logger *slog.Logger) *Synthetic {
	return &Synthetic{
		logger: logger,
		slain:  newSlainDetective(),
	}
}

func (s *Synthetic) ProcessMessages(msgs []messages.Message) ([]messages.Message, error) {
	for _, msg := range msgs {
		s.slain.ProcessMessage(msg)
	}

	return msgs, nil
}
