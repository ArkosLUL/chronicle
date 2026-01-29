package realm_test

import (
	"testing"
	"time"

	"github.com/Emyrk/chronicle/combatlog/parser/types/realm"
	"github.com/stretchr/testify/require"
)

func TestParseRealmInfo(t *testing.T) {
	t.Parallel()

	cases := []struct {
		input string
		exp   realm.Info
	}{
		{
			input: "REALM_INFO: 21.01.26 22:30:49&1.18.0&7234&Dec 19 2025&Ambershire",
			exp: realm.Info{
				Seen:      time.Date(2026, 1, 21, 22, 30, 49, 0, time.UTC),
				Version:   "1.18.0",
				Build:     7234,
				BuildDate: "Dec 19 2025",
				RealmName: "Ambershire",
			},
		},
	}

	for _, c := range cases {
		t.Run(c.input, func(t *testing.T) {
			t.Parallel()
			got, err := realm.ParseRealmInfo(c.input)
			require.NoError(t, err)
			require.Equal(t, c.exp, got)
		})
	}
}

func TestIsRealmInfo(t *testing.T) {
	t.Parallel()

	_, ok := realm.IsRealmInfo("REALM_INFO: 21.01.26 22:30:49&1.18.0&7234&Dec 19 2025&Ambershire")
	require.True(t, ok)

	_, ok = realm.IsRealmInfo("ZONE_INFO: something")
	require.False(t, ok)
}
