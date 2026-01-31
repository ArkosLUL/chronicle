package realmclock_test

import (
	"testing"
	"time"

	"github.com/Emyrk/chronicle/combatlog/parser/types/realmclock"
	"github.com/stretchr/testify/require"
)

func TestClockInfo(t *testing.T) {
	t.Parallel()

	cases := []struct {
		input string
		exp   realmclock.Info
	}{
		{
			// Central time UTC-6
			input: "CLOCK_INFO: 30.01.26 19:53:21&31.01.26 01:53:21",
			exp: realmclock.Info{
				LocalTime: time.Date(2026, 1, 30, 19, 53, 21, 0, time.UTC),
				UTCTime:   time.Date(2026, 1, 31, 1, 53, 21, 0, time.UTC),
				Offset:    time.Hour * 6,
			},
		},
	}

	for _, c := range cases {
		t.Run(c.input, func(t *testing.T) {
			t.Parallel()
			got, err := realmclock.ParseClockInfo(c.input)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			require.Equal(t, c.exp, got)
			require.Equal(t, c.input, got.String())
		})
	}
}
