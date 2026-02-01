package parser_test

import (
	"testing"

	"github.com/Emyrk/chronicle/combatlog/parser/types"
	"github.com/stretchr/testify/require"
)

func TestHitTypeBitwise(t *testing.T) {
	t.Parallel()

	h := types.HitTypeHit
	h = h & ^types.HitTypeHit
	require.False(t, h.Has(types.HitTypeHit))
}
