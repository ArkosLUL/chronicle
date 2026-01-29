package playerposition_test

import (
	"testing"
	"time"

	"github.com/Emyrk/chronicle/combatlog/parser/playerposition"
	"github.com/stretchr/testify/require"
)

func TestParsePlayerPosition(t *testing.T) {
	t.Parallel()

	cases := []struct {
		input string
		exp   playerposition.PlayerPosition
	}{
		{
			input: "PLAYER_POSITION: 21.01.26 22:34:10&1&0.526611&0.490571",
			exp: playerposition.PlayerPosition{
				Seen: time.Date(2026, 1, 21, 22, 34, 10, 0, time.UTC),
				Guid: "1",
				X:    0.526611,
				Y:    0.490571,
			},
		},
	}

	for _, c := range cases {
		t.Run(c.input, func(t *testing.T) {
			t.Parallel()
			got, err := playerposition.ParsePlayerPosition(c.input)
			require.NoError(t, err)
			require.Equal(t, c.exp, got)
		})
	}
}

func TestIsPlayerPosition(t *testing.T) {
	t.Parallel()

	_, ok := playerposition.IsPlayerPosition("PLAYER_POSITION: 21.01.26 22:30:36&1&0.583857&0.447757")
	require.True(t, ok)

	_, ok = playerposition.IsPlayerPosition("REALM_INFO: something")
	require.False(t, ok)
}
