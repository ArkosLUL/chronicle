package smlibrary

import (
	"fmt"
	"log/slog"
	"strings"

	"github.com/Emyrk/chronicle/combatlog/parser/types/zone"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/unitdb"
)

var _ encounters.Instance = (*Library)(nil)

// Library is the Scarlet Monastery Library instance
type Library struct {
	logger *slog.Logger
	db     *unitdb.Units

	CurrentZone zone.Zone
	Characters  encounters.Characters
	*encounters.Identifier
}

func New(logger *slog.Logger, db *unitdb.Units, z zone.Zone) *Library {
	c := &Library{
		logger:      logger,
		db:          db,
		Characters:  encounters.NewCharacters(),
		CurrentZone: z,
    // TODO: Populate hostile identifiers
		Identifier:  encounters.NewIdentifier(nil),
	}

	return c
}

func (c *Library) CharactersList() encounters.Characters {
	return c.Characters
}

func (c *Library) Name() string {
	return "Scarlet Monastery Library"
}

func (c *Library) MatchesZone(z zone.Zone) bool {
	return strings.ToLower(z.Name) == "scarlet monastery library"
}

func (c *Library) Process(m messages.Message) error {
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
