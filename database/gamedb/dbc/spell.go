package dbc

import (
	"time"

	"github.com/Emyrk/chronicle/internal/bitmask"
	"github.com/Gophercraft/core/format/dbc/dbdefs"
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
	School             School     // Magic school: physical, holy, fire, nature, frost, shadow, arcane
	SpellPriority      int32      // AI priority for NPC spell selection
	StanceBarOrder     int32      // Position on stance/shapeshift action bar
	ProcTypeMask       ProcFlags  // Events that can trigger this spell (on hit, on crit, on kill, etc.)
	ProcFlags          int32      // Additional proc configuration
	ProcChance         int32      // Percent chance to proc (>100 means server-side calculation)
	ProcCharges        int32      // Number of times proc can trigger before aura fades (0 = unlimited)
	Speed              float32    // Projectile travel speed in yards/sec (0 = instant)
	DispelType         DispelType // Dispel category: 0=none, 1=magic, 2=curse, 3=disease, 4=poison
	AuraInterruptFlags AuraInterruptFlags
	ModalNextSpell     int32          // The "Modal" suggests it's about spells that share a button slot but swap based on game state.
	InterruptFlags     InterruptFlags // what can interrupt a spell while casting (different from AuraInterruptFlags which is for buffs).
	CumulativeAura     int32          // Max charges I think?

	// === Resource Cost ===
	PowerType        Power    // Resource type: 0=mana, 1=rage, 2=focus, 3=energy
	ManaCost         int32    // Flat resource cost
	ManaCostPct      int32    // Cost as percentage of base mana
	ManaCostPerLevel int32    // Additional cost per caster level
	ManaPerSecond    int32    // Resource drain per second while channeling
	Reagent          []ItemID // Required consumable item IDs (up to 8)
	ReagentCount     []int32  // Quantity of each reagent consumed per cast

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
	Effect                   []Effect        // Effect type: damage, heal, apply aura, summon, etc.
	EffectDieSides           []int32         // Random range: value = BasePoints + rand(1, DieSides)
	EffectRealPointsPerLevel []float32       // Bonus points per caster level (for scaling)
	EffectBasePoints         []int32         // Base value for effect calculations
	EffectMechanic           []int32         // Combat mechanic: stun, root, bleed, etc. (for immunity checks)
	EffectRadiusIndex        []SpellRadiusID // AoE radius lookup (→ SpellRadius.dbc)
	EffectAura               []AuraEffect    // Aura type if Effect is ApplyAura (mod stat, periodic damage, etc.)
	EffectAuraPeriod         []int32         // Tick interval in ms for periodic effects (e.g., 3000 = 3 sec)
	EffectAmplitude          []float32       // Amplitude modifier for periodic effects
	EffectChainTargets       []int32         // Number of chain/bounce targets (Chain Lightning, etc.)
	EffectItemType           []ItemID        // Item created/affected by effect (Conjure Water creates item 5350)
	EffectMiscValue          []int32         // Context-dependent: stat type, power type, creature ID, etc.
	EffectTriggerSpell       []SpellID       // Spell triggered by this effect (procs, chain casts)
	EffectPointsPerCombo     []float32       // Bonus points per combo point (rogue/druid finishers)
	EffectBaseDice           []int32         // Base dice count for damage variance
	EffectDicePerLevel       []int32         // Additional dice per caster level
	EffectChainAmplitude     []float32       // Damage multiplier per chain bounce (e.g., 0.7 = 30% reduction)

	// === Totem Requirements (Shaman) ===
	TotemsID int32     // Totem category/type ID
	Totem    [2]ItemID // Required totem tool item IDs (not consumed, just must be in inventory)

	// TODO: Reagents

	// --- Fields below commented out for now, uncomment as needed ---
	// Mechanic                 int32
	// ShapeshiftMask           []int32
	// ShapeshiftExclude        []int32
	// TargetCreatureType       int32
	// RequiresSpellFocus       int32
	// FacingCasterFlags        int32
	// CasterAuraState          int32
	// TargetAuraState          int32
	// ExcludeCasterAuraState   int32
	// ExcludeTargetAuraState   int32
	// ChannelInterruptFlags    []int32
	// ImplicitTargetA          []int32
	// ImplicitTargetB          []int32
	// SpellVisualID            []int32
	// MaxTargets               int32
	// DefenseType              int32
	// MinFactionID             int32
	// MinReputation            int32
	// RequiredAuraVision       int32
	// RequiredAreasID          int32

	//
	// CastUI                   int32
	// ManaPerSecondPerLevel    int32
	// RequiredAreaID           int32
	// ProcFlags                int32

	// No value
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
	// RuneCostID               int32 // Always 0
	// SpellMissileID           int32 // Always 0
	// DescriptionVariablesID   int32 // Always 0
	// AuraOptionsID            int32
	// AuraRestrictionsID       int32
	// CastingRequirementsID    int32
	// ClassOptionsID           int32
	// EquippedItemsID          int32
	// InterruptsID             int32
	// LevelsID                 int32
	// TargetRestrictionsID     int32
	// RequiredProjectID        int32
	// MiscID                   int32
	// CasterAuraSpell          int32
	// TargetAuraSpell          int32
	// ExcludeCasterAuraSpell   int32
	// ExcludeTargetAuraSpell   int32
	// PowerDisplayID           int32
}

func NewSpell(def dbdefs.Ent_Spell) *Spell {
	return &Spell{
		ID:                   SpellID(def.ID),
		Name_lang:            def.Name_lang,
		NameSubtext_lang:     def.NameSubtext_lang,
		Description_lang:     def.Description_lang,
		AuraDescription_lang: def.AuraDescription_lang,
		SpellIconID:          IconID(def.SpellIconID),
		//PowerType:            def.PowerType,
		ManaCost:         def.ManaCost,
		ManaCostPct:      def.ManaCostPct,
		CastingTimeIndex: CastingTimeID(def.CastingTimeIndex),
		//RecoveryTime:     def.RecoveryTime,
		RangeIndex: RangeID(def.RangeIndex),
		Attrs: SpellAttributes{
			uint32(def.Attributes),
			uint32(def.AttributesEx),
			uint32(def.AttributesExB),
			uint32(def.AttributesExC),
			uint32(def.AttributesExD),
			uint32(def.AttributesExE),
			uint32(def.AttributesExF),
			uint32(def.AttributesExG),
			uint32(def.AttributesExH),
		},
		Targets: TargetFlags(def.Targets),
	}
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
