package dbc

import (
	"time"

	"github.com/Emyrk/chronicle/internal/bitmask"
	"github.com/Gophercraft/core/i18n"
)

type Spell struct {
	// === Core Identification ===
	ID                   SpellID   // Unique spell identifier
	Name_lang            i18n.Text // Localized spell name (e.g., "Fireball")
	NameSubtext_lang     i18n.Text // Rank or subtext (e.g., "Rank 1", "Passive", "Racial")
	Description_lang     i18n.Text // Tooltip description with placeholders like $d (duration), $s1 (effect 1 value)
	AuraDescription_lang i18n.Text // Buff/debuff tooltip shown when aura is active

	// === Display ===
	SpellIconID  IconID // Icon shown in spellbook and action bars (→ SpellIcon.dbc)
	ActiveIconID IconID // Icon shown while spell is active/channeling (often 0)

	// === Level Requirements ===
	MaxLevel       int32           // Level cap for scaling (0 = no cap)
	BaseLevel      int32           // Minimum player level to use this spell
	SpellLevel     int32           // Spell's own level for scaling calculations
	Category       SpellCategoryID // Spell category for shared cooldowns (→ SpellCategory.dbc)
	MaxTargetLevel int32           // Maximum target level (0 = no limit, used for CC diminishing)

	// === Behavior ===
	School             School      // Magic school: physical, holy, fire, nature, frost, shadow, arcane
	SpellPriority      int32       // AI priority for NPC spell selection
	StanceBarOrder     int32       // Position on stance/shapeshift action bar
	ProcTypeMask       ProcFlags   // Events that can trigger this spell (on hit, on crit, on kill, etc.)
	ProcFlags          ProcFlagsEx // Additional proc configuration
	ProcChance         int32       // Percent chance to proc (>100 means server-side calculation)
	ProcCharges        int32       // Number of times proc can trigger before aura fades (0 = unlimited)
	Speed              float32     // Projectile travel speed in yards/sec (0 = instant)
	DispelType         DispelType  // Dispel category: 0=none, 1=magic, 2=curse, 3=disease, 4=poison
	AuraInterruptFlags AuraInterruptFlags
	ModalNextSpell     int32          // The "Modal" suggests it's about spells that share a button slot but swap based on game state.
	InterruptFlags     InterruptFlags // what can interrupt a spell while casting (different from AuraInterruptFlags which is for buffs).
	CumulativeAura     int32          // Max charges I think?
	Mechanic           Mechanic       // Combat mechanic: stun, root, silence, etc. (for immunity checks)
	DefenseType        DefenseType    // How the target can defend against this spell
	CasterAuraState    AuraState      // what state the target must be in for the spell to be usable.
	TargetAuraState    AuraState
	MaxTargets         int32
	TargetCreatureType TargetCreatureType
	RequiresSpellFocus SpellFocusObject // The game checks if there's a matching game object within range (usually ~5 yards) before allowing the cast.

	// === Resource Cost ===
	PowerType        Power     // Resource type: 0=mana, 1=rage, 2=focus, 3=energy
	ManaCost         int32     // Flat resource cost
	ManaCostPct      int32     // Cost as percentage of base mana
	ManaCostPerLevel int32     // Additional cost per caster level
	ManaPerSecond    int32     // Resource drain per second while channeling
	Reagent          [8]ItemID // Required consumable item IDs (up to 8)
	ReagentCount     [8]int32  // Quantity of each reagent consumed per cast

	// === Timing ===
	CastingTimeIndex      CastingTimeID // Cast time lookup (→ SpellCastTimes.dbc)
	RecoveryTime          time.Duration // Spell cooldown in milliseconds
	StartRecoveryCategory int32         // controls which Global Cooldown (GCD) group a spell belongs to.
	StartRecoveryTime     time.Duration // GCD in ms
	CategoryRecoveryTime  time.Duration // Shared cooldown in milliseconds for spells in the same category
	RangeIndex            RangeID       // Min/max range lookup (→ SpellRange.dbc)
	DurationIndex         DurationID    // Buff/debuff duration lookup (→ SpellDuration.dbc)

	// === Filtering/Logic ===
	Attrs                SpellAttributes      // 9 attribute flags controlling spell behavior (can't crit, channeled, etc.)
	Targets              TargetFlags          // Valid target types (self, party, enemy, etc.)
	SpellClassSet        SpellClassSet        // What class can use the spell
	SpellClassMask       SpellClassMask       // Every spell has a 96 bit mask to identify it (for talents)
	EquippedItemInvTypes EquippedItemInvTypes // bitmask of inventory slot types required to use the spell.
	EquippedItemClass    EquippedItemClass    // Item required to use the spell
	EquippedItemSubclass bitmask.Bitmask32    // Subclass is either ArmorSubclass or WeaponSubclass, depending on EquippedItemClass
	PreventionType       PreventionType

	// === Effect Data (up to 3 effects per spell, index 0-2) ===
	Effect                   [3]Effect         // Effect type: damage, heal, apply aura, summon, etc.
	EffectDieSides           [3]int32          // Random range: value = BasePoints + rand(1, DieSides)
	EffectRealPointsPerLevel [3]float32        // Bonus points per caster level (for scaling)
	EffectBasePoints         [3]int32          // Base value for effect calculations
	EffectMechanic           [3]int32          // Combat mechanic: stun, root, bleed, etc. (for immunity checks)
	EffectRadiusIndex        [3]SpellRadiusID  // AoE radius lookup (→ SpellRadius.dbc)
	EffectAura               [3]AuraEffect     // Aura type if Effect is ApplyAura (mod stat, periodic damage, etc.)
	EffectAuraPeriod         [3]int32          // Tick interval in ms for periodic effects (e.g., 3000 = 3 sec)
	EffectAmplitude          [3]float32        // Amplitude modifier for periodic effects
	EffectChainTargets       [3]int32          // Number of chain/bounce targets (Chain Lightning, etc.)
	EffectItemType           [3]ItemID         // Item created/affected by effect (Conjure Water creates item 5350)
	EffectMiscValue          [3]int32          // Context-dependent: stat type, power type, creature ID, etc.
	EffectTriggerSpell       [3]SpellID        // Spell triggered by this effect (procs, chain casts)
	EffectPointsPerCombo     [3]float32        // Bonus points per combo point (rogue/druid finishers)
	EffectBaseDice           [3]int32          // Base dice count for damage variance
	EffectDicePerLevel       [3]int32          // Additional dice per caster level
	EffectChainAmplitude     [3]float32        // Damage multiplier per chain bounce (e.g., 0.7 = 30% reduction)
	ImplicitTargetA          [3]ImplicitTarget // Primary targeting for each effect: who/what the effect affects (self, enemy, ally, area, etc.)
	ImplicitTargetB          [3]ImplicitTarget // Secondary targeting for each effect: typically the location/destination (used for movement, AoE placement, etc.)

	// === Totem Requirements (Shaman) ===
	TotemsID int32     // Totem category/type ID
	Totem    [2]ItemID // Required totem tool item IDs (not consumed, just must be in inventory)

	// === Other ===
	CastUI             int32
	RequiredAuraVision int32
	MinFactionID       int32
	MinReputation      int32
	SpellVisualID      [2]int32

	// No value
	//RequiredAreaID          int32
	//ShapeshiftMask          []int32
	//ShapeshiftExclude       []int32
	//ChannelInterruptFlags   []int32
	//FacingCasterFlags       int32
	//ScalingID               int32     // Always 0
	//SchoolMask              int32     // Always 0
	//CategoriesID            int32     // Always 0
	//CooldownsID             int32     // Always 0
	//Difficulty              int32     // Used for mythic/20man/heroic
	//ShapeshiftID            int32     // Always 0
	//ReagentsID              int32     // Always 0
	//ManaPerSecondPerLevel   int32     // Always 0
	//EffectSpellClassMaskA   []int32   // Always nil
	//EffectSpellClassMaskB   []int32   // Always nil
	//EffectSpellClassMaskC   []int32   // Always nil
	//EffectBonusCoefficient  []float32 // always nil
	//RequiredTotemCategoryID []int32   // Always nil
	//EffectMiscValueB        []int32   // Always nil
	//EffectRadiusIndexB      []int32   // Always nil
	//RuneCostID              int32     // Always 0
	//SpellMissileID          int32     // Always 0
	//DescriptionVariablesID  int32     // Always 0
	//AuraOptionsID           int32
	//AuraRestrictionsID      int32
	//CastingRequirementsID   int32
	//ClassOptionsID          int32
	//EquippedItemsID         int32
	//InterruptsID            int32
	//LevelsID                int32
	//TargetRestrictionsID    int32
	//RequiredProjectID       int32
	//MiscID                  int32
	//CasterAuraSpell         int32
	//TargetAuraSpell         int32
	//ExcludeCasterAuraSpell  int32
	//ExcludeTargetAuraSpell  int32
	//PowerDisplayID          int32
	//ManaPerSecondPerLevel   int32
	//ExcludeCasterAuraState  int32
	//ExcludeTargetAuraState  int32
}

func (s Spell) String() string {
	return s.Name_lang.String()
}

// Name returns the spell name as a string (convenience for English locale).
func (s Spell) Name() string {
	return s.Name_lang.String()
}

// Subtext returns the subtext (rank) as a string.
func (s Spell) Subtext() string {
	return s.NameSubtext_lang.String()
}

// Description returns the description as a string.
func (s Spell) Description() string {
	return s.Description_lang.String()
}

// AuraDescription returns the aura description as a string.
func (s Spell) AuraDescription() string {
	return s.AuraDescription_lang.String()
}
