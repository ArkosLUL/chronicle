package blackrockspire

import (
	"fmt"
	"log/slog"
	"strings"

	"github.com/Emyrk/chronicle/combatlog/parser/guid"
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
	Characters  *encounters.Characters
	*encounters.Identifier
}

func New(logger *slog.Logger, db *unitdb.Units, z zone.Zone) *BlackrockSpire {
	c := &BlackrockSpire{
		logger:      logger,
		db:          db,
		Characters:  encounters.NewCharacters(db),
		CurrentZone: z,
		Identifier:  encounters.NewIdentifier(BlackrockSpireHostiles()),
	}

	return c
}

func (c *BlackrockSpire) CharactersList() map[guid.GUID]*encounters.Character {
	return c.Characters.All
}

func (c *BlackrockSpire) Name() string {
	return "Blackrock Spire"
}

func (c *BlackrockSpire) MatchesZone(z zone.Zone) bool {
	return strings.ToLower(z.Name) == "blackrock spire"
}

func (c *BlackrockSpire) Process(m messages.Message) error {
	err := c.Characters.Process(m)
	if err != nil {
		return fmt.Errorf("processing characters: %w", err)
	}
	return nil
}
