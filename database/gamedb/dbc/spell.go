package dbc

import (
	"github.com/Gophercraft/core/format/dbc/dbdefs"
	"github.com/Gophercraft/core/i18n"
)

type Spell struct {
	// Core identification
	ID                   int32
	Name_lang            i18n.Text
	NameSubtext_lang     i18n.Text // "Rank 1", "Passive", etc.
	Description_lang     i18n.Text
	AuraDescription_lang i18n.Text

	// Display
	SpellIconID int32
	SchoolMask  int32 // Bitmask: 1=phys, 2=holy, 4=fire, 8=nature, 16=frost, 32=shadow, 64=arcane

	// Cost
	PowerType   int32 // 0=mana, 1=rage, 2=focus, 3=energy
	ManaCost    int32
	ManaCostPct int32

	// Timing
	CastingTimeIndex int32 // → SpellCastTimes.dbc lookup
	RecoveryTime     int32 // Cooldown in ms
	RangeIndex       int32 // → SpellRange.dbc lookup

	// Filtering/logic
	Attrs   SpellAttributes
	Targets TargetFlags

	// --- Fields below commented out for now, uncomment as needed ---
	// RuneCostID               int32
	// SpellMissileID           int32
	// DescriptionVariablesID   int32
	// ScalingID                int32
	// AuraOptionsID            int32
	// AuraRestrictionsID       int32
	// CastingRequirementsID    int32
	// CategoriesID             int32
	// ClassOptionsID           int32
	// CooldownsID              int32
	// EquippedItemsID          int32
	// InterruptsID             int32
	// LevelsID                 int32
	// ReagentsID               int32
	// ShapeshiftID             int32
	// TargetRestrictionsID     int32
	// TotemsID                 int32
	// RequiredProjectID        int32
	// MiscID                   int32
	// Category                 int32
	// DispelType               int32
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
	// CasterAuraSpell          int32
	// TargetAuraSpell          int32
	// ExcludeCasterAuraSpell   int32
	// ExcludeTargetAuraSpell   int32
	// CategoryRecoveryTime     int32
	// InterruptFlags           int32
	// AuraInterruptFlags       []int32
	// ChannelInterruptFlags    []int32
	// ProcTypeMask             int32
	// ProcChance               int32
	// ProcCharges              int32
	// MaxLevel                 int32
	// BaseLevel                int32
	// SpellLevel               int32
	// DurationIndex            int32
	// ManaCostPerLevel         int32
	// ManaPerSecond            int32
	// Speed                    float32
	// ModalNextSpell           int32
	// CumulativeAura           int32
	// Totem                    []int32
	// Reagent                  []int32
	// ReagentCount             []int32
	// EquippedItemClass        int32
	// EquippedItemSubclass     int32
	// EquippedItemInvTypes     int32
	// Effect                   []int32
	// EffectDieSides           []int32
	// EffectRealPointsPerLevel []float32
	// EffectBasePoints         []int32
	// EffectMechanic           []int32
	// ImplicitTargetA          []int32
	// ImplicitTargetB          []int32
	// EffectRadiusIndex        []int32
	// EffectRadiusIndexB       []int32
	// EffectAura               []int32
	// EffectAuraPeriod         []int32
	// EffectAmplitude          []float32
	// EffectChainTargets       []int32
	// EffectItemType           []int32
	// EffectMiscValue          []int32
	// EffectMiscValueB         []int32
	// EffectTriggerSpell       []int32
	// EffectPointsPerCombo     []float32
	// EffectSpellClassMaskA    []int32
	// EffectSpellClassMaskB    []int32
	// EffectSpellClassMaskC    []int32
	// SpellVisualID            []int32
	// ActiveIconID             int32
	// StartRecoveryCategory    int32
	// StartRecoveryTime        int32
	// MaxTargetLevel           int32
	// SpellClassSet            int32
	// SpellClassMask           []int32
	// MaxTargets               int32
	// DefenseType              int32
	// PreventionType           int32
	// StanceBarOrder           int32
	// EffectChainAmplitude     []float32
	// MinFactionID             int32
	// MinReputation            int32
	// RequiredAuraVision       int32
	// RequiredTotemCategoryID  []int32
	// RequiredAreasID          int32
	// PowerDisplayID           int32
	// EffectBonusCoefficient   []float32
	// Difficulty               int32
	// CastUI                   int32
	// ManaPerSecondPerLevel    int32
	// EffectBaseDice           []int32
	// EffectDicePerLevel       []int32
	// SpellPriority            int32
	// RequiredAreaID           int32
	// School                   int32
	// ProcFlags                int32
}

func NewSpell(def dbdefs.Ent_Spell) *Spell {
	return &Spell{
		ID:                   def.ID,
		Name_lang:            def.Name_lang,
		NameSubtext_lang:     def.NameSubtext_lang,
		Description_lang:     def.Description_lang,
		AuraDescription_lang: def.AuraDescription_lang,
		SpellIconID:          def.SpellIconID,
		SchoolMask:           def.SchoolMask,
		PowerType:            def.PowerType,
		ManaCost:             def.ManaCost,
		ManaCostPct:          def.ManaCostPct,
		CastingTimeIndex:     def.CastingTimeIndex,
		RecoveryTime:         def.RecoveryTime,
		RangeIndex:           def.RangeIndex,
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
