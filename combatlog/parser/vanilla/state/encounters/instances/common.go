package instances

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/Emyrk/chronicle/combatlog/parser/types"
	"github.com/Emyrk/chronicle/combatlog/parser/types/zone"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters/character"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters/period"
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

	// Live fight tracking
	currentFight   *LiveFight
	completedFights []Fight
}

// LiveFight tracks an ongoing fight during message processing.
type LiveFight struct {
	Start    time.Time
	End      time.Time
	Hostiles map[guid.GUID]*liveCharacterFight
}

type liveCharacterFight struct {
	ID       guid.GUID
	Activity []period.Period
	// activeIdx tracks the index of the last period we've seen from this character.
	// -1 means we haven't processed any periods yet.
	activeIdx int
}

func (c *Common) Finalize(ctx context.Context) ([]Encounter, error) {
	// Finalize any current fight that hasn't been completed yet
	if c.currentFight != nil {
		c.completedFights = append(c.completedFights, c.currentFight.ToFight())
		c.currentFight = nil
	}

	encounters := make([]Encounter, 0, len(c.completedFights))
	for _, fight := range c.completedFights {
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
	actChange, err := c.Characters.Process(m)
	if err != nil {
		return fmt.Errorf("processing characters: %w", err)
	}

	if actChange {
		c.FightProcess(m)
	}

	return nil
}

// InFight returns true if there is an active fight with at least one active hostile.
func (c *Common) InFight() bool {
	if c.currentFight == nil {
		return false
	}
	for id := range c.currentFight.Hostiles {
		char, ok := c.Characters.All[id]
		if ok && char.IsActive() {
			return true
		}
	}
	return false
}

// CurrentFight returns the current live fight, or nil if not in combat.
func (c *Common) CurrentFight() *LiveFight {
	return c.currentFight
}

// Fights returns all completed fights plus the current fight if active.
func (c *Common) Fights() []Fight {
	fights := make([]Fight, len(c.completedFights))
	copy(fights, c.completedFights)

	if c.currentFight != nil {
		fights = append(fights, c.currentFight.ToFight())
	}
	return fights
}

// ToFight converts a LiveFight to a Fight (snapshot of current state).
func (lf *LiveFight) ToFight() Fight {
	hostiles := make(map[guid.GUID]CharacterFight, len(lf.Hostiles))
	for id, lcf := range lf.Hostiles {
		hostiles[id] = CharacterFight{
			ID:       lcf.ID,
			Activity: lcf.Activity,
		}
	}
	return Fight{
		Start:    lf.Start,
		End:      lf.End,
		Hostiles: hostiles,
	}
}

const fightCooldown = 100 * time.Millisecond

// FightProcess updates live fight state based on character activity changes.
// Call this after Characters.Process returns true (activity changed).
func (c *Common) FightProcess(m messages.Message) {
	now := m.Date()

	// Collect all hostile characters and their current state
	for id, char := range c.Characters.All {
		info := c.IdentifyUnit(id)
		if !info.Hostile {
			continue
		}

		periods := char.Periods()
		if len(periods) == 0 {
			continue
		}

		// If no current fight, check if we should start one
		if c.currentFight == nil {
			// Only start a fight if there's an active period
			if char.IsActive() {
				c.currentFight = &LiveFight{
					Start:    periods[0].Start.Timestamp.Date(),
					End:      now,
					Hostiles: make(map[guid.GUID]*liveCharacterFight),
				}
				c.currentFight.Hostiles[id] = &liveCharacterFight{
					ID:        id,
					Activity:  periods,
					activeIdx: len(periods) - 1,
				}
			}
			continue
		}

		// We have a current fight - check if this character belongs to it
		lcf, inFight := c.currentFight.Hostiles[id]
		if !inFight {
			// New character - check if their first period overlaps with current fight
			firstPeriod := periods[0]
			periodStart := firstPeriod.Start.Timestamp.Date()

			// Belongs to fight if starts within cooldown of fight end
			if periodStart.Before(c.currentFight.End.Add(fightCooldown)) || periodStart.Equal(c.currentFight.End.Add(fightCooldown)) {
				c.currentFight.Hostiles[id] = &liveCharacterFight{
					ID:        id,
					Activity:  periods,
					activeIdx: len(periods) - 1,
				}
				// Update fight boundaries
				if periodStart.Before(c.currentFight.Start) {
					c.currentFight.Start = periodStart
				}
				c.updateFightEnd(now)
			}
			continue
		}

		// Character already in fight - update their periods
		lcf.Activity = periods
		lcf.activeIdx = len(periods) - 1
		c.updateFightEnd(now)
	}

	// Check if fight has ended (no active hostiles and cooldown expired)
	if c.currentFight != nil && !c.InFight() {
		// All hostiles inactive - check if cooldown has passed
		if now.After(c.currentFight.End.Add(fightCooldown)) {
			c.completedFights = append(c.completedFights, c.currentFight.ToFight())
			c.currentFight = nil
		}
	}
}

// updateFightEnd extends the fight's end time based on all hostile periods.
func (c *Common) updateFightEnd(now time.Time) {
	if c.currentFight == nil {
		return
	}

	latestEnd := c.currentFight.End
	for _, lcf := range c.currentFight.Hostiles {
		for _, p := range lcf.Activity {
			var periodEnd time.Time
			if p.End != nil {
				periodEnd = p.End.Timestamp.Date()
			} else {
				// Active period - use current time
				periodEnd = now
			}
			if periodEnd.After(latestEnd) {
				latestEnd = periodEnd
			}
		}
	}
	c.currentFight.End = latestEnd
}
