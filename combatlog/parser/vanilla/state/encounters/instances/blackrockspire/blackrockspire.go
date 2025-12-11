package blackrockspire

import (
	"fmt"
	"log/slog"
	"strings"

	"github.com/Emyrk/chronicle/combatlog/parser/types/zone"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/unitdb"
)

var _ encounters.Instance = (*BlackrockSpire)(nil)

// BlackrockSpire is the Scarlet Monastery BlackrockSpire instance
type BlackrockSpire struct {
	logger *slog.Logger
	db     *unitdb.Units

	CurrentZone zone.Zone
	Characters  encounters.Characters
}

func New(logger *slog.Logger, db *unitdb.Units, z zone.Zone) *BlackrockSpire {
	c := &BlackrockSpire{
		logger:      logger,
		db:          db,
		Characters:  encounters.NewCharacters(),
		CurrentZone: z,
	}

	return c
}

func (c *BlackrockSpire) CharactersList() encounters.Characters {
	return c.Characters
}

func (c *BlackrockSpire) Name() string {
	return "Blackrock Spire"
}

func (c *BlackrockSpire) MatchesZone(z zone.Zone) bool {
	return strings.ToLower(z.Name) == "blackrock spire"
}

func (c *BlackrockSpire) Process(m messages.Message) error {
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
