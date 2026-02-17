package chrondbc

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestAttribute_BlockAndMask(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		attr      Attribute
		wantBlock int
		wantMask  uint32
	}{
		// Block 0
		{"Attr_ProcFailureBurnsCharge", Attr_ProcFailureBurnsCharge, 0, 1 << 0},
		{"Attr_UsesRangedSlot", Attr_UsesRangedSlot, 0, 1 << 1},
		{"Attr_Passive", Attr_Passive, 0, 1 << 6},
		{"Attr_NoAuraCancel", Attr_NoAuraCancel, 0, 1 << 31},

		// Block 1
		{"AttrEx_DismissPet", AttrEx_DismissPet, 1, 1 << 0},
		{"AttrEx_NotBreakStealth", AttrEx_NotBreakStealth, 1, 1 << 5},
		{"AttrEx_Unk31", AttrEx_Unk31, 1, 1 << 31},

		// Block 2
		{"AttrEx2_CanTargetDead", AttrEx2_CanTargetDead, 2, 1 << 0},
		{"AttrEx2_FoodBuff", AttrEx2_FoodBuff, 2, 1 << 31},

		// Block 3
		{"AttrEx3_OutOfCombatAttack", AttrEx3_OutOfCombatAttack, 3, 1 << 0},
		{"AttrEx3_Unk31", AttrEx3_Unk31, 3, 1 << 31},

		// Block 4
		{"AttrEx4_IgnoreResistances", AttrEx4_IgnoreResistances, 4, 1 << 0},
		{"AttrEx4_Unk31", AttrEx4_Unk31, 4, 1 << 31},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			require.Equal(t, tt.wantBlock, tt.attr.Block(), "block mismatch")
			require.Equal(t, tt.wantMask, tt.attr.Mask(), "mask mismatch")
		})
	}
}

func TestSpellAttributes_Has(t *testing.T) {
	t.Parallel()

	// Simulate a spell with:
	// - Block 0: Passive (bit 6)
	// - Block 1: NotBreakStealth (bit 5)
	// - Block 2: FoodBuff (bit 31)
	attrs := SpellAttributes{
		0: 1 << 6,  // Attr_Passive
		1: 1 << 5,  // AttrEx_NotBreakStealth
		2: 1 << 31, // AttrEx2_FoodBuff
	}

	require.True(t, attrs.Has(Attr_Passive))
	require.True(t, attrs.Has(AttrEx_NotBreakStealth))
	require.True(t, attrs.Has(AttrEx2_FoodBuff))

	require.False(t, attrs.Has(Attr_UsesRangedSlot))
	require.False(t, attrs.Has(AttrEx_DismissPet))
	require.False(t, attrs.Has(AttrEx3_OutOfCombatAttack))
}

func TestSpellAttributes_SetAndClear(t *testing.T) {
	t.Parallel()

	var attrs SpellAttributes

	// Initially nothing set
	require.False(t, attrs.Has(Attr_Passive))
	require.False(t, attrs.Has(AttrEx_NotBreakStealth))

	// Set some attributes
	attrs.Set(Attr_Passive)
	attrs.Set(AttrEx_NotBreakStealth)

	require.True(t, attrs.Has(Attr_Passive))
	require.True(t, attrs.Has(AttrEx_NotBreakStealth))

	// Clear one
	attrs.Clear(Attr_Passive)

	require.False(t, attrs.Has(Attr_Passive))
	require.True(t, attrs.Has(AttrEx_NotBreakStealth))
}
