package character

import (
	"time"

	"github.com/Emyrk/chronicle/combatlog/parser/guid"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
)

const (
	highPriestessJeklik = 14517
	bloodSeekerBat      = 11368
)

func NewHighPriestessJeklik(id guid.GUID, all *Characters) (Character, bool) {
	return NewAdsGoWithBoss(highPriestessJeklik, bloodSeekerBat)(id, all)
}

const (
	highPriestMarli = 14510
	venomBrood      = 14532
)

func NewHighPriestMarli(id guid.GUID, all *Characters) (Character, bool) {
	return NewAdsGoWithBoss(highPriestMarli, venomBrood)(id, all)
}

const (
	highPriestArlokk = 14515
	zulianProwler    = 15101
)

func NewHighPriestArlokk(id guid.GUID, all *Characters) (Character, bool) {
	return NewAdsGoWithBoss(highPriestArlokk, zulianProwler)(id, all)
}

type HighPriestThekalParty struct {
	*Common
	all *Characters

	// pendingDeath records a death event that may be reversed by resurrection.
	// If we see activity within resurrectionWindow after this timestamp, we
	// clear pendingDeath and stay active. Otherwise, we trim back to this death.
	pendingDeath *messages.Message
}

const (
	// resurrectionWindow is how long to wait for resurrection activity after death.
	// In Thekal's phase 1, zealots can resurrect each other within ~10s.
	resurrectionWindow = 15 * time.Second
)

const (
	highPriestThekal = 14599
	zealotZath       = 11348
	zealotLorKhan    = 11347
)

func NewHighPriestThekalParty(id guid.GUID, all *Characters) (Character, bool) {
	if !id.IsCreature() {
		return nil, false
	}

	entry, ok := id.GetEntry()
	if !ok {
		return nil, false
	}

	switch entry {
	case zealotZath, zealotLorKhan, highPriestThekal:
	// in the party!
	default:
		return nil, false
	}

	return &HighPriestThekalParty{
		Common: NewCommonCharacter(id, all),
		all:    all,
	}, true
}

func (c *HighPriestThekalParty) Process(m messages.Message) error {
	// Timeouts should be checked on every timestamp
	cur, ok := c.Activity.Current()
	if ok {
		cur.HandleTimeout(m.Date())
	}

	// Check if pending death should be finalized (no resurrection occurred)
	c.checkPendingDeath(m)

	return processCommonActivity(c, m)
}

// checkPendingDeath finalizes a pending death if the resurrection window has passed.
func (c *HighPriestThekalParty) checkPendingDeath(m messages.Message) {
	if c.pendingDeath == nil {
		return
	}

	deathTime := (*c.pendingDeath).Date()
	if m.Date().Sub(deathTime) >= resurrectionWindow {
		// No resurrection occurred within the window - finalize the death
		c.finalizeDeath()
	}
}

// finalizeDeath ends the current period at the pending death timestamp.
func (c *HighPriestThekalParty) finalizeDeath() {
	if c.pendingDeath == nil {
		return
	}

	deathMsg := *c.pendingDeath
	c.pendingDeath = nil
	c.Common.Died("zealot_death_finalized", deathMsg)
}

// Died handles the death of Thekal and his zealots.
// During phase 1, deaths are "pending" - if we see activity within the
// resurrection window, the death is cancelled. Otherwise, it's finalized.
func (c *HighPriestThekalParty) Died(reason string, m messages.Message) {
	// Record death as pending - will be finalized if no resurrection occurs
	c.pendingDeath = &m
	c.LastSlain = m
}

// Start overrides Common.Start to handle resurrection detection.
// If we see activity while death is pending, the unit was resurrected.
func (c *HighPriestThekalParty) Start(reason string, m messages.Message) {
	if c.pendingDeath != nil {
		// Activity after death = resurrection occurred, cancel the pending death
		c.pendingDeath = nil
	}
	c.Common.Start(reason, m)
}

// DELTE BEWLO

func (c *HighPriestThekalParty) IsThekal() bool {
	entry, ok := c.ID().GetEntry()
	return ok && entry == highPriestThekal
}

func (c *HighPriestThekalParty) getThekal() (*HighPriestThekalParty, bool) {
	return c.get(highPriestThekal)
}

func (c *HighPriestThekalParty) getZath() (*HighPriestThekalParty, bool) {
	return c.get(zealotZath)
}

func (c *HighPriestThekalParty) getLorKhan() (*HighPriestThekalParty, bool) {
	return c.get(zealotLorKhan)
}

func (c *HighPriestThekalParty) get(entry uint32) (*HighPriestThekalParty, bool) {
	thek, ok := c.all.ByEntry[entry]
	if !ok || len(thek) != 1 {
		return nil, false
	}

	typed, ok := thek[0].(*HighPriestThekalParty)
	if !ok {
		return nil, false
	}

	return typed, true
}
