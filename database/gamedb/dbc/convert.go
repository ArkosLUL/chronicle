package dbc

import (
	"time"

	"github.com/Emyrk/chronicle/database/gamedb/dbcdb"
	"github.com/Emyrk/chronicle/internal/bitmask"
	"github.com/Gophercraft/core/format/dbc"
	"github.com/Gophercraft/core/format/dbc/dbdefs"
)

// type Table[T any] interface {
//	Underlying() *dbc.Table
//	Len() int
//	Range(f func(cursor *T) bool) error
//	Index(i int) (*T, error)
//}

var _ dbcdb.Table[Spell] = (*Spells)(nil)

type Spells struct {
	under dbcdb.Table[dbdefs.Ent_Spell]
}

func (s Spells) Underlying() *dbc.Table { return s.under.Underlying() }
func (s Spells) Len() int               { return s.under.Len() }

func (s Spells) Range(f func(cursor *Spell) bool) error {
	return s.under.Range(func(cursor *dbdefs.Ent_Spell) bool {
		sp := SpellFromDB(cursor)
		return f(sp)
	})
}

func (s Spells) Index(i int) (*Spell, error) {
	dbSp, err := s.under.Index(i)
	if err != nil {
		return nil, err
	}
	sp := SpellFromDB(dbSp)
	return sp, nil
}

// SpellFromDB converts a raw DBC spell entry to our typed Spell struct.
func SpellFromDB(def *dbdefs.Ent_Spell) *Spell {
	s := &Spell{
		// === Core Identification ===
		ID:                   SpellID(def.ID),
		Name_lang:            def.Name_lang,
		NameSubtext_lang:     def.NameSubtext_lang,
		Description_lang:     def.Description_lang,
		AuraDescription_lang: def.AuraDescription_lang,

		// === Display ===
		SpellIconID:  IconID(def.SpellIconID),
		ActiveIconID: IconID(def.ActiveIconID),

		// === Level Requirements ===
		MaxLevel:       def.MaxLevel,
		BaseLevel:      def.BaseLevel,
		SpellLevel:     def.SpellLevel,
		Category:       SpellCategoryID(def.Category),
		MaxTargetLevel: def.MaxTargetLevel,

		// === Behavior ===
		School:             School(def.School),
		SpellPriority:      def.SpellPriority,
		StanceBarOrder:     def.StanceBarOrder,
		ProcTypeMask:       ProcFlags(def.ProcTypeMask),
		ProcFlags:          ProcFlagsEx(def.ProcFlags),
		ProcChance:         def.ProcChance,
		ProcCharges:        def.ProcCharges,
		Speed:              def.Speed,
		DispelType:         DispelType(def.DispelType),
		InterruptFlags:     InterruptFlags(def.InterruptFlags),
		ModalNextSpell:     def.ModalNextSpell,
		CumulativeAura:     def.CumulativeAura,
		Mechanic:           Mechanic(def.Mechanic),
		DefenseType:        DefenseType(def.DefenseType),
		CasterAuraState:    AuraState(def.CasterAuraState),
		TargetAuraState:    AuraState(def.TargetAuraState),
		MaxTargets:         def.MaxTargets,
		TargetCreatureType: TargetCreatureType(def.TargetCreatureType),
		RequiresSpellFocus: SpellFocusObject(def.RequiresSpellFocus),

		// === Resource Cost ===
		PowerType:        Power(def.PowerType),
		ManaCost:         def.ManaCost,
		ManaCostPct:      def.ManaCostPct,
		ManaCostPerLevel: def.ManaCostPerLevel,
		ManaPerSecond:    def.ManaPerSecond,

		// === Timing ===
		CastingTimeIndex:      CastingTimeID(def.CastingTimeIndex),
		RecoveryTime:          time.Duration(def.RecoveryTime) * time.Millisecond,
		StartRecoveryCategory: def.StartRecoveryCategory,
		StartRecoveryTime:     time.Duration(def.StartRecoveryTime) * time.Millisecond,
		CategoryRecoveryTime:  time.Duration(def.CategoryRecoveryTime) * time.Millisecond,
		RangeIndex:            RangeID(def.RangeIndex),
		DurationIndex:         DurationID(def.DurationIndex),

		// === Filtering/Logic ===
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
		Targets:              TargetFlags(def.Targets),
		SpellClassSet:        SpellClassSet(def.SpellClassSet),
		EquippedItemInvTypes: EquippedItemInvTypes(def.EquippedItemInvTypes),
		EquippedItemClass:    EquippedItemClass(def.EquippedItemClass),
		EquippedItemSubclass: bitmask.Bitmask32(def.EquippedItemSubclass),
		PreventionType:       PreventionType(def.PreventionType),

		// === Other ===
		TotemsID:           def.TotemsID,
		CastUI:             def.CastUI,
		RequiredAuraVision: def.RequiredAuraVision,
		MinFactionID:       def.MinFactionID,
		MinReputation:      def.MinReputation,
		SpellVisualID:      def.SpellVisualID,
	}

	// AuraInterruptFlags - use first element if available
	if len(def.AuraInterruptFlags) > 0 {
		s.AuraInterruptFlags = AuraInterruptFlags(def.AuraInterruptFlags[0])
	}

	// SpellClassMask - combine two int32s into uint64
	if len(def.SpellClassMask) >= 2 {
		s.SpellClassMask = NewSpellClassMask(def.SpellClassMask[0], def.SpellClassMask[1])
	} else if len(def.SpellClassMask) == 1 {
		s.SpellClassMask = SpellClassMask(uint32(def.SpellClassMask[0]))
	}

	// Reagents
	s.Reagent = make([]ItemID, 0, len(def.Reagent))
	for _, r := range def.Reagent {
		s.Reagent = append(s.Reagent, ItemID(r))
	}
	s.ReagentCount = def.ReagentCount

	// Totems
	for i := 0; i < 2 && i < len(def.Totem); i++ {
		s.Totem[i] = ItemID(def.Totem[i])
	}

	// === Effect Arrays (up to 3 effects) ===
	for i := 0; i < 3; i++ {
		if i < len(def.Effect) {
			s.Effect[i] = Effect(def.Effect[i])
		}
		if i < len(def.EffectDieSides) {
			s.EffectDieSides[i] = def.EffectDieSides[i]
		}
		if i < len(def.EffectRealPointsPerLevel) {
			s.EffectRealPointsPerLevel[i] = def.EffectRealPointsPerLevel[i]
		}
		if i < len(def.EffectBasePoints) {
			s.EffectBasePoints[i] = def.EffectBasePoints[i]
		}
		if i < len(def.EffectMechanic) {
			s.EffectMechanic[i] = def.EffectMechanic[i]
		}
		if i < len(def.EffectRadiusIndex) {
			s.EffectRadiusIndex[i] = SpellRadiusID(def.EffectRadiusIndex[i])
		}
		if i < len(def.EffectAura) {
			s.EffectAura[i] = AuraEffect(def.EffectAura[i])
		}
		if i < len(def.EffectAuraPeriod) {
			s.EffectAuraPeriod[i] = def.EffectAuraPeriod[i]
		}
		if i < len(def.EffectAmplitude) {
			s.EffectAmplitude[i] = def.EffectAmplitude[i]
		}
		if i < len(def.EffectChainTargets) {
			s.EffectChainTargets[i] = def.EffectChainTargets[i]
		}
		if i < len(def.EffectItemType) {
			s.EffectItemType[i] = ItemID(def.EffectItemType[i])
		}
		if i < len(def.EffectMiscValue) {
			s.EffectMiscValue[i] = def.EffectMiscValue[i]
		}
		if i < len(def.EffectTriggerSpell) {
			s.EffectTriggerSpell[i] = SpellID(def.EffectTriggerSpell[i])
		}
		if i < len(def.EffectPointsPerCombo) {
			s.EffectPointsPerCombo[i] = def.EffectPointsPerCombo[i]
		}
		if i < len(def.EffectBaseDice) {
			s.EffectBaseDice[i] = def.EffectBaseDice[i]
		}
		if i < len(def.EffectDicePerLevel) {
			s.EffectDicePerLevel[i] = def.EffectDicePerLevel[i]
		}
		if i < len(def.EffectChainAmplitude) {
			s.EffectChainAmplitude[i] = def.EffectChainAmplitude[i]
		}
		if i < len(def.ImplicitTargetA) {
			s.ImplicitTargetA[i] = ImplicitTarget(def.ImplicitTargetA[i])
		}
		if i < len(def.ImplicitTargetB) {
			s.ImplicitTargetB[i] = ImplicitTarget(def.ImplicitTargetB[i])
		}
	}

	return s
}
