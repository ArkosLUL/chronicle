package chrondbc

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSpell_AttackOutcome(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		spell    Spell
		expected AttackOutcome
	}{
		{
			name: "MeleeBlockable",
			spell: Spell{
				DefenseType: DefenseTypeMelee,
				Attrs:       attrsWithBlockable(),
			},
			expected: AttackOutcomeMiss | AttackOutcomeHit | AttackOutcomeDodge | AttackOutcomeParry | AttackOutcomeBlock | AttackOutcomeCrit,
		},
		{
			name: "Ranged",
			spell: Spell{
				DefenseType: DefenseTypeRanged,
			},
			expected: AttackOutcomeMiss | AttackOutcomeHit | AttackOutcomeDodge | AttackOutcomeCrit,
		},
		{
			name: "MagicResistable",
			spell: Spell{
				DefenseType: DefenseTypeMagic,
			},
			expected: AttackOutcomeMiss | AttackOutcomeHit | AttackOutcomeResist | AttackOutcomeCrit,
		},
		{
			name: "MagicIgnoresResistances",
			spell: Spell{
				DefenseType: DefenseTypeMagic,
				Attrs:       attrsWith(AttrEx4_IgnoreResistances),
			},
			expected: AttackOutcomeMiss | AttackOutcomeHit | AttackOutcomeCrit,
		},
		{
			name: "NoActiveDefenseMelee",
			spell: Spell{
				DefenseType: DefenseTypeMelee,
				Attrs:       attrsWith(Attr_NoActiveDefense),
			},
			expected: AttackOutcomeMiss | AttackOutcomeHit | AttackOutcomeCrit,
		},
		{
			name: "NoActiveDefenseMagic",
			spell: Spell{
				DefenseType: DefenseTypeMagic,
				Attrs:       attrsWith(Attr_NoActiveDefense),
			},
			expected: AttackOutcomeMiss | AttackOutcomeHit | AttackOutcomeResist | AttackOutcomeCrit,
		},
		{
			name: "NoActiveDefenseMagicIgnoreResist",
			spell: Spell{
				DefenseType: DefenseTypeMagic,
				Attrs:       attrsWith(Attr_NoActiveDefense, AttrEx4_IgnoreResistances),
			},
			expected: AttackOutcomeMiss | AttackOutcomeHit | AttackOutcomeCrit,
		},
		{
			name: "CantCrit",
			spell: Spell{
				DefenseType: DefenseTypeMelee,
				Attrs:       attrsWith(AttrEx2_CantCrit),
			},
			expected: AttackOutcomeMiss | AttackOutcomeDodge | AttackOutcomeParry | AttackOutcomeHit | AttackOutcomeBlock,
		},
		{
			name: "DefenseTypeNone",
			spell: Spell{
				DefenseType: DefenseTypeNone,
			},
			expected: AttackOutcomeMiss | AttackOutcomeHit,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			result := tc.spell.AttackOutcome()
			assert.Equal(t, tc.expected, result, "AttackOutcome mismatch for %s", tc.name)
		})
	}
}

// attrsWith creates SpellAttributes with the given attributes set.
func attrsWith(attrs ...Attribute) SpellAttributes {
	var sa SpellAttributes
	for _, a := range attrs {
		sa.Set(a)
	}
	return sa
}

// attrsWithBlockable creates SpellAttributes with AttrEx3_BlockableSpell set.
func attrsWithBlockable() SpellAttributes {
	return attrsWith(AttrEx3_BlockableSpell)
}

func TestSpell_SpellDamageNoEngageCombat_MutuallyExclusive(t *testing.T) {
	t.Parallel()

	otherBits := []SpellDamageType{
		SpellDamageDirect,
		SpellDamagePeriodic,
		SpellDamagePeriodicTrigger,
		SpellDamageActiveDebuff,
	}

	tests := []struct {
		name  string
		spell Spell
	}{
		{
			name: "DistractOnly",
			spell: Spell{
				Effect: [3]Effect{EffectDistract},
			},
		},
		{
			name: "DistractAndDirectDamage",
			spell: Spell{
				Effect: [3]Effect{EffectDistract, EffectSchoolDMG},
			},
		},
		{
			name: "DistractAndPeriodic",
			spell: Spell{
				Effect:     [3]Effect{EffectDistract, EffectApplyAura},
				EffectAura: [3]AuraEffect{0, AuraEffectPeriodicDamage},
			},
		},
		{
			name: "DistractAndPeriodicTrigger",
			spell: Spell{
				Effect:     [3]Effect{EffectDistract, EffectApplyAura},
				EffectAura: [3]AuraEffect{0, AuraEffectPeriodicTriggerSpell},
			},
		},
		{
			name: "DistractAndActiveDebuff",
			spell: Spell{
				Effect:          [3]Effect{EffectDistract, EffectApplyAura},
				EffectAura:      [3]AuraEffect{0, AuraEffectModResistance},
				ImplicitTargetA: [3]ImplicitTarget{0, ImplicitTargetUnitTargetEnemy},
			},
		},
		{
			name: "ModDetectRangeOnly",
			spell: Spell{
				Effect:     [3]Effect{EffectApplyAura},
				EffectAura: [3]AuraEffect{AuraEffectModDetectRange},
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			result := tc.spell.SpellDamageType()

			if result.Has(SpellDamageNoEngageCombat) {
				for _, bit := range otherBits {
					assert.False(t, result.Has(bit),
						"SpellDamageNoEngageCombat must be mutually exclusive with %#x", bit)
				}
			}
		})
	}
}

