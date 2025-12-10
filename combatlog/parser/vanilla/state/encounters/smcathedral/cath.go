package smcathedral

import (
	"log/slog"

	"github.com/Emyrk/chronicle/combatlog/parser/types/zone"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/unitdb"
)

type Cathedral struct {
	Logger *slog.Logger
	db     *unitdb.Units

	Fights *encounters.Fights
}

func New(logger *slog.Logger, db *unitdb.Units, zone zone.Zone) *Cathedral {
	return &Cathedral{
		Logger: logger,
		db:     db,
		Fights: encounters.NewFights(logger, db),
	}
}

func (c *Cathedral) Zone() string { return "scarlet monastery cathedral" }

func (c *Cathedral) Process(m messages.Message) error {
	return c.Fights.Process(m)
}
