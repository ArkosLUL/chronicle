package smcathedral

import (
	"fmt"
	"log/slog"
	"strings"

	"github.com/Emyrk/chronicle/combatlog/parser/types/zone"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/unitdb"
)

// Cathedral is the Scarlet Monastery Cathedral instance
type Cathedral struct {
	logger *slog.Logger
	db     *unitdb.Units

	Characters encounters.Characters
}

func New(logger *slog.Logger, db *unitdb.Units, z zone.Zone) *Cathedral {
	c := &Cathedral{
		logger:     logger,
		db:         db,
		Characters: encounters.NewCharacters(),
	}

	return c
}

func (c *Cathedral) Name() string {
	return "Scarlet Monastery Cathedral"
}

func (c *Cathedral) MatchesZone(z zone.Zone) bool {
	return strings.ToLower(z.Name) == "scarlet monastery cathedral"
}

func (c *Cathedral) Process(m messages.Message) error {
	// Add all affected characters to the instance's character list
	c.Characters.AddAll(m.Date(), m.Affects()...)

	// Process the message through fight tracking
	for _, ch := range c.Characters {
		err := ch.Process(m)
		if err != nil {
			return fmt.Errorf("processing character %s: %w", ch.ID.String(), err)
		}
	}

	return nil
}
