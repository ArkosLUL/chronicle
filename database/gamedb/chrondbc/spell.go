package chrondbc

import (
	"time"

	"github.com/Emyrk/chronicle/internal/bitmask"
	"github.com/Gophercraft/core/i18n"
)

type Spell struct {
	// === Core Identification ===
	ID                   SpellID   `json:"id"`
	Name_lang            i18n.Text `json:"name"`
	NameSubtext_lang     i18n.Text `json:"subtext"`
	Description_lang     i18n.Text `json:"description"`
	AuraDescription_lang i18n.Text `json:"aura_description"`

	// === Display ===
	SpellIconID  IconID `json:"spell_icon"`
	ActiveIconID IconID `json:"active_icon"`

	// === Level Requirements ===
	MaxLevel       int32           `json:"max_level"`
	BaseLevel      int32           `json:"base_level"`
	SpellLevel     int32           `json:"spell_level"`
	Category       SpellCategoryID `json:"category"`
	MaxTargetLevel int32           `json:"max_target_level"`

	// === Behavior ===
	School             School             `json:"school"`
	SpellPriority      int32              `json:"spell_priority"`
	StanceBarOrder     int32              `json:"stance_bar_order"`
	ProcTypeMask       ProcFlags          `json:"proc_type_mask"`
	ProcFlags          ProcFlagsEx        `json:"proc_flags"`
	ProcChance         int32              `json:"proc_chance"`
	ProcCharges        int32              `json:"proc_charges"`
	Speed              float32            `json:"speed"`
	DispelType         DispelType         `json:"dispel_type"`
	AuraInterruptFlags AuraInterruptFlags `json:"aura_interrupt_flags"`
	ModalNextSpell     int32              `json:"modal_next_spell"`
	InterruptFlags     InterruptFlags     `json:"interrupt_flags"`
	CumulativeAura     int32              `json:"cumulative_aura"`
	Mechanic           Mechanic           `json:"mechanic"`
	DefenseType        DefenseType        `json:"defense_type"`
	CasterAuraState    AuraState          `json:"caster_aura_state"`
	TargetAuraState    AuraState          `json:"target_aura_state"`
	MaxTargets         int32              `json:"max_targets"`
	TargetCreatureType TargetCreatureType `json:"target_creature_type"`
	RequiresSpellFocus SpellFocusObject   `json:"requires_spell_focus"`

	// === Resource Cost ===
	PowerType        Power     `json:"power_type"`
	ManaCost         int32     `json:"mana_cost"`
	ManaCostPct      int32     `json:"mana_cost_pct"`
	ManaCostPerLevel int32     `json:"mana_cost_per_level"`
	ManaPerSecond    int32     `json:"mana_per_second"`
	Reagent          [8]ItemID `json:"reagent"`
	ReagentCount     [8]int32  `json:"reagent_count"`

	// === Timing ===
	CastingTimeIndex      CastingTimeID `json:"casting_time"`
	RecoveryTime          time.Duration `json:"recovery_time"`
	StartRecoveryCategory int32         `json:"start_recovery_category"`
	StartRecoveryTime     time.Duration `json:"start_recovery_time"`
	CategoryRecoveryTime  time.Duration `json:"category_recovery_time"`
	RangeIndex            RangeID       `json:"range"`
	DurationIndex         DurationID    `json:"duration"`

	// === Filtering/Logic ===
	Attrs                SpellAttributes      `json:"attributes"`
	Targets              TargetFlags          `json:"targets"`
	SpellClassSet        SpellClassSet        `json:"spell_class_set"`
	SpellClassMask       SpellClassMask       `json:"spell_class_mask"`
	EquippedItemInvTypes EquippedItemInvTypes `json:"equipped_item_inv_types"`
	EquippedItemClass    EquippedItemClass    `json:"equipped_item_class"`
	EquippedItemSubclass bitmask.Bitmask32    `json:"equipped_item_subclass"`
	PreventionType       PreventionType       `json:"prevention_type"`

	// === Effect Data (up to 3 effects per spell, index 0-2) ===
	Effect                   [3]Effect         `json:"effect"`
	EffectDieSides           [3]int32          `json:"effect_die_sides"`
	EffectRealPointsPerLevel [3]float32        `json:"effect_real_points_per_level"`
	EffectBasePoints         [3]int32          `json:"effect_base_points"`
	EffectMechanic           [3]int32          `json:"effect_mechanic"`
	EffectRadiusIndex        [3]SpellRadiusID  `json:"effect_radius"`
	EffectAura               [3]AuraEffect     `json:"effect_aura"`
	EffectAuraPeriod         [3]int32          `json:"effect_aura_period"`
	EffectAmplitude          [3]float32        `json:"effect_amplitude"`
	EffectChainTargets       [3]int32          `json:"effect_chain_targets"`
	EffectItemType           [3]ItemID         `json:"effect_item_type"`
	EffectMiscValue          [3]int32          `json:"effect_misc_value"`
	EffectTriggerSpell       [3]SpellID        `json:"effect_trigger_spell"`
	EffectPointsPerCombo     [3]float32        `json:"effect_points_per_combo"`
	EffectBaseDice           [3]int32          `json:"effect_base_dice"`
	EffectDicePerLevel       [3]int32          `json:"effect_dice_per_level"`
	EffectChainAmplitude     [3]float32        `json:"effect_chain_amplitude"`
	ImplicitTargetA          [3]ImplicitTarget `json:"implicit_target_a"`
	ImplicitTargetB          [3]ImplicitTarget `json:"implicit_target_b"`

	// === Totem Requirements (Shaman) ===
	TotemsID int32     `json:"totems_id"`
	Totem    [2]ItemID `json:"totem"`

	// === Other ===
	CastUI             int32    `json:"cast_ui"`
	RequiredAuraVision int32    `json:"required_aura_vision"`
	MinFactionID       int32    `json:"min_faction_id"`
	MinReputation      int32    `json:"min_reputation"`
	SpellVisualID      [2]int32 `json:"spell_visual_id"`
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
