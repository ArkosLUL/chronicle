package dbc_test

import (
	"testing"

	"github.com/Emyrk/chronicle/database/gamedb/dbc"
	"github.com/stretchr/testify/require"
)

func TestSpellClassMask(t *testing.T) {
	t.Parallel()

	require.Equal(t, dbc.NewSpellClassMask(1, 0), uint64(1))
}
