package instances

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/Emyrk/chronicle/combatlog/parseoptions"
	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/Emyrk/chronicle/combatlog/parser/types"
	"github.com/Emyrk/chronicle/combatlog/parser/types/realm"
	"github.com/Emyrk/chronicle/combatlog/parser/types/zone"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/parseerrors"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters/character"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters/encounterevents"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters/period"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/guild"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/unitdb"
	"github.com/google/uuid"
)

var _ Instance = (*Common)(nil)

// Common is used for instances that have no custom mechanics beyond character
// mechanics.
type Common struct {
	name          string
	zoneNameMatch func(z string) bool
	verbose       bool

	logger *slog.Logger
	db     *unitdb.Units

	CurrentZone zone.Zone
	Characters  *character.Characters
	*Identifier

	// Live fight tracking
	currentFight    *OngoingFight
	completedFights []Fight
	events          *encounterevents.Events
	seen            map[guid.GUID]struct{}
	realm           *realm.Info

	// General summaries
	Guild *guild.Tracker
}

type FinalizedInstance struct {
	Realm      *realm.Info
	Encounters []Encounter
	Guilds     *guild.Tracker
}

func (c *Common) Finalize(ctx context.Context) (*FinalizedInstance, error) {
	if false && c.currentFight != nil {
		// TODO: We need to end any ongoing fight with what timestamp?
		// Finalize any current fight that hasn't been completed yet
		err := c.finalizeFight()
		if err != nil {
			return nil, fmt.Errorf("finalizing ongoing fight: %w", err)
		}
	}

	encounters := make([]Encounter, 0, len(c.completedFights))
	for _, fight := range c.completedFights {
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		encounterName := ""
		encounterType := types.EncounterTypeTRASH
		isBossFight := false
		// TODO: Fix to boss count, as there can be 2 bosses
		aBossRemains := false
		for hid, h := range fight.Hostiles {
			if ctx.Err() != nil {
				return nil, ctx.Err()
			}
			if hid != h.ID {
				panic("inconsistent hostile ID mapping")
			}

			id := c.IdentifyUnit(h.ID)
			if !id.Hostile {
				continue
			}
			if id.Boss {
				isBossFight = true
				// Check if this boss was slain
				lastPeriod := h.Activity[len(h.Activity)-1]
				aBossRemains = aBossRemains || lastPeriod.EndState != period.EndStateSlain
			}

			// Always take the encounter name if set
			if id.EncounterName != "" {
				encounterName = id.EncounterName
				encounterType = types.EncounterTypeBOSS
			}

			if encounterName == "" {
				info, hasInfo := c.db.Get(h.ID)
				if hasInfo {
					encounterName = info.Name
				}
			}
		}

		rr := fight.EndStates()

		// Determine kill type based on remaining enemies and boss status
		var killType KillType
		if len(rr.Timeouts) == 0 {
			killType = KillTypeClean
			if rr.Slain == 0 && rr.Reset > 0 {
				killType = KillTypeReset
				if isBossFight && !aBossRemains {
					killType = KillTypePartial
				}
			}
		} else if isBossFight && !aBossRemains {
			// No bosses remain, but it was a boss fight.
			// An add probably lived
			killType = KillTypePartial
		} else {
			if len(fight.PlayerDeaths) == 0 {
				killType = KillTypeReset
			} else {
				killType = KillTypeWipe
			}
		}

		encounters = append(encounters, Encounter{
			Name:      encounterName,
			Type:      encounterType,
			Combat:    fight,
			KillType:  killType,
			Remaining: rr.Timeouts,
			Boss:      isBossFight,
		})
	}

	return &FinalizedInstance{
		Realm:      c.realm,
		Encounters: encounters,
		Guilds:     c.Guild,
	}, nil
}

func ZoneNameMatcher(names ...string) func(z string) bool {
	return func(z string) bool {
		for _, name := range names {
			if z == name {
				return true
			}
		}
		return false
	}
}

type CommonFactory struct {
	Name           string
	ZoneName       func(z string) bool
	OtherZoneNames []string
	Hostiles       func() *Identifier
}

func (f *CommonFactory) New(ctx context.Context, logger *slog.Logger, db *unitdb.Units, z zone.Zone) *Common {
	characters := character.NewCharacters(db)
	c := &Common{
		name:          f.Name,
		zoneNameMatch: f.ZoneName,
		logger:        logger,
		db:            db,
		CurrentZone:   z,
		Characters:    characters,
		Identifier:    f.Hostiles(),
		events:        encounterevents.NewEvents(),
		seen:          make(map[guid.GUID]struct{}),
		Guild:         guild.New(),
		verbose:       parseoptions.IsVerbose(ctx),
	}

	return c
}

func (c *Common) Zone() zone.Zone {
	return c.CurrentZone
}

func (c *Common) CharactersList() map[guid.GUID]character.Character {
	return c.Characters.All.Map()
}

func (c *Common) Name() string {
	return c.name
}

func (c *Common) MatchesZone(z zone.Zone) bool {
	return c.zoneNameMatch(z.Name)
}

func (c *Common) Process(m messages.Message) error {
	switch msg := m.(type) {
	case *messages.Realm:
		if c.realm != nil {
			if c.realm.RealmName != msg.RealmName {
				return parseerrors.AsFatalError(fmt.Errorf("realm name changed from %q to %q during instance", c.realm.RealmName, msg.RealmName))
			}
		}
		c.realm = &msg.Info
	case *messages.Combatant:
		// Combatants do not count as "seen", since the addon tracks them async
	default:
		for _, id := range m.Affects() {
			c.seen[id] = struct{}{}
		}
	}

	actChange, err := c.Characters.Process(m)
	if err != nil {
		return fmt.Errorf("processing characters: %w", err)
	}

	if actChange {
		err = c.FightDetectionHandler(m)
		if err != nil {
			return fmt.Errorf("processing fight: %w", err)
		}
	} else if c.currentFight != nil && c.currentFight.Start != nil {
		// Keep track of player deaths.
		// TODO: Ideally this code is in a tracker of some sort.
		if isSlain, ok := m.(*messages.Slain); ok {
			if isSlain.Victim.IsPlayer() {
				c.currentFight.PlayerDeaths = append(c.currentFight.PlayerDeaths, isSlain)
			}
		}

		// Inside a fight, record all events.
		err = c.currentFight.Events.Process(m)
		if err != nil {
			return fmt.Errorf("processing encounter messages: %w", err)
		}
	}

	err = c.Guild.Process(m)
	if err != nil {
		return fmt.Errorf("processing guild info: %w", err)
	}

	return nil
}

func (c *Common) Seen() map[guid.GUID]struct{} {
	return c.seen
}

func (c *Common) Events() *encounterevents.Events {
	return c.events
}

// Fights returns all completed fights minus the current fight in progress.
func (c *Common) Fights() []Fight {
	fights := make([]Fight, len(c.completedFights))
	copy(fights, c.completedFights)
	return fights
}

// FightDetectionHandler updates live fight state based on character activity changes.
// Call this after Characters.Process returns true (activity changed).
//
// Make sure to add any events to the current fight. This is the edge detection,
// and these events must be added in here.
func (c *Common) FightDetectionHandler(m messages.Message) error {
	if c.currentFight == nil {
		c.currentFight = &OngoingFight{
			EncounterID:    uuid.New(),
			ActiveHostiles: make(map[guid.GUID]struct{}),
			Events:         encounterevents.New(c.verbose),
			Start:          nil,
			End:            nil,
		}
	}

	// First handle the start time by iterating over all characters and looking for
	// active hostiles.
	activeTotal := 0
	var latestEnd *period.Moment
	for _, char := range c.Characters.All.Map() {
		if info := c.IdentifyUnit(char.ID()); !info.Hostile {
			// Only consider hostile characters for fights
			continue
		}

		pd, ok := char.CurrentPeriod()
		if !ok {
			continue
		}

		if pd.IsActive() {
			// If the character is active, update the fight start time if needed.
			activeTotal++
			c.currentFight.ActiveHostiles[char.ID()] = struct{}{}

			if c.currentFight.Start == nil {
				c.currentFight.Start = pd.Start
			} else if c.currentFight.Start.Timestamp.Date().After(pd.Start.Timestamp.Date()) {
				c.currentFight.Start = pd.Start
			}
		}

		if !pd.IsActive() {
			// If the character is no longer active, check if they were part of the fight
			if _, inFight := c.currentFight.ActiveHostiles[char.ID()]; !inFight {
				// If the character is not part of the fight, then skip
				continue
			}

			// If the latestEnd is not yet set, we still are trying to find it.
			if latestEnd == nil {
				latestEnd = pd.End
			} else if pd.End != nil && latestEnd.Timestamp.Date().Before(pd.End.Timestamp.Date()) {
				latestEnd = pd.End
			}
		}
	}

	if c.currentFight.Start == nil {
		// No active characters in the fight
		return nil
	}

	if c.currentFight.Start != nil {
		err := c.currentFight.Events.Process(m)
		if err != nil {
			return fmt.Errorf("processing encounter messages: %w", err)
		}
	}

	// Now handle the end time
	if activeTotal == 0 {
		c.currentFight.End = latestEnd
		err := c.finalizeFight()
		if err != nil {
			return fmt.Errorf("finalizing fight: %w", err)
		}
	}
	return nil
}

func (c *Common) finalizeFight() error {
	fight := Fight{
		Hostiles:     map[guid.GUID]CharacterFight{},
		Start:        c.currentFight.Start.Timestamp.Date(),
		End:          c.currentFight.End.Timestamp.Date(),
		EncounterID:  c.currentFight.EncounterID,
		PlayerDeaths: c.currentFight.PlayerDeaths,
	}

	for id := range c.currentFight.ActiveHostiles {
		char, ok := c.Characters.Get(id)
		if !ok {
			return fmt.Errorf("could not find character for hostile %s", id)
		}

		during, err := period.PeriodsDuring(char.Periods(), fight.Start, fight.End)
		if err != nil {
			return fmt.Errorf("getting periods during fight for character %s: %w", id, err)
		}

		fight.Hostiles[id] = CharacterFight{
			ID:       id,
			Activity: during,
		}
	}

	err := c.currentFight.Events.Finalize(c.events, fight.EncounterID)
	if err != nil {
		return fmt.Errorf("finalizing encounter messages: %w", err)
	}

	c.currentFight = nil
	// End the fight
	c.completedFights = append(c.completedFights, fight)
	return nil
}
