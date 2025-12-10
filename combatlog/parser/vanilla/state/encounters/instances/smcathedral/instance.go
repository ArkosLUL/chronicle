package smcathedral

import (
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

	// All possible encounters in this instance
	encounters []encounters.Encounter

	// Fight tracking
	fights           *encounters.Fights
	currentEncounter encounters.Encounter
	currentZone      zone.Zone
}

func New(logger *slog.Logger, db *unitdb.Units, z zone.Zone) *Cathedral {
	c := &Cathedral{
		logger:      logger,
		db:          db,
		fights:      encounters.NewFights(logger, db, z, CathedralHostiles()),
		currentZone: z,
	}

	// Define all encounters in this instance
	//c.encounters = []encounters.Encounter{
	//	NewWhitemaneEncounter(),
	//	NewMograineEncounter(),
	//	// Add more encounters as needed
	//}

	return c
}

func (c *Cathedral) Name() string {
	return "Scarlet Monastery Cathedral"
}

func (c *Cathedral) MatchesZone(z zone.Zone) bool {
	return strings.ToLower(z.Name) == "scarlet monastery cathedral"
}

func (c *Cathedral) Process(m messages.Message) error {
	// Process the message through fight tracking
	err := c.fights.Process(m)
	if err != nil {
		return err
	}

	// If we have a current fight, try to detect which encounter it is
	//if c.fights.CurrentFight != nil && c.fights.CurrentFight.IsStarted() {
	//	c.detectEncounter(m)
	//}

	return nil
}

func (c *Cathedral) Encounters() []encounters.Encounter {
	return c.encounters
}

func (c *Cathedral) CurrentEncounter() encounters.Encounter {
	return c.currentEncounter
}

func (c *Cathedral) AllFights() []*encounters.Fight {
	return c.fights.Fights
}
