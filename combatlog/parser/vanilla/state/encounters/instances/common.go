package instances

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/Emyrk/chronicle/combatlog/parser/types"
	"github.com/Emyrk/chronicle/combatlog/parser/types/zone"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters/character"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/unitdb"
)

var _ Instance = (*Common)(nil)

// Common is used for instances that have no custom mechanics beyond character
// mechanics.
type Common struct {
	name          string
	zoneNameMatch string

	logger *slog.Logger
	db     *unitdb.Units

	CurrentZone zone.Zone
	Characters  *character.Characters
	*Identifier
}

func (c *Common) Finalize(ctx context.Context) ([]Encounter, error) {
	fights, diags := AggregateFights(c)
	if diags.HasErrors() {
		return nil, diags
	}

	encounters := make([]Encounter, 0, len(fights))
	for _, fight := range fights {
		encounterName := ""
		encounterType := types.EncounterTypeTRASH
		for _, h := range fight.Hostiles {
			id := c.IdentifyUnit(h.ID)
			if !id.Hostile {
				continue
			}

			// TODO: Do this better
			if id.EncounterName != "" {
				encounterName = id.EncounterName
				encounterType = types.EncounterTypeBOSS
				break
			}

			info, ok := c.db.Get(h.ID)
			if ok {
				encounterName = info.Name
			}
		}
		encounters = append(encounters, Encounter{
			Name:   encounterName,
			Type:   encounterType,
			Combat: fight,
			IsKill: fight.IsKill(),
		})
	}

	return encounters, nil
}

type CommonFactory struct {
	Name     string
	ZoneName string
	Hostiles func() *Identifier
}

func (f *CommonFactory) New(logger *slog.Logger, db *unitdb.Units, z zone.Zone) *Common {
	return &Common{
		name:          f.Name,
		zoneNameMatch: f.ZoneName,
		logger:        logger,
		db:            db,
		CurrentZone:   z,
		Characters:    character.NewCharacters(db),
		Identifier:    f.Hostiles(),
	}
}

func (c *Common) Zone() zone.Zone {
	return c.CurrentZone
}

func (c *Common) CharactersList() map[guid.GUID]character.Character {
	return c.Characters.All
}

func (c *Common) Name() string {
	return c.name
}

func (c *Common) MatchesZone(z zone.Zone) bool {
	return strings.ToLower(z.Name) == c.zoneNameMatch
}

func (c *Common) Process(m messages.Message) error {
	err := c.Characters.Process(m)
	if err != nil {
		return fmt.Errorf("processing characters: %w", err)
	}

	return nil
}
