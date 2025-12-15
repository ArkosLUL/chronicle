package sorter_test

import (
	"bytes"
	"math/rand"
	"slices"
	"strings"
	"testing"

	"github.com/Emyrk/chronicle/combatlog/parser/sorter"
	"github.com/Emyrk/chronicle/internal/testutil"
	"github.com/stretchr/testify/require"
)

func TestUnitInfoFirst(t *testing.T) {
	t.Parallel()

	logs := []string{
		"12/11 12:40:06.392  0x00000000000C270C casts Windfury Totem.",
		"12/11 12:40:06.549  0x000000000004C53D gains 264 health from your Renew.",
		"12/11 12:40:06.560  Renew fades from 0x000000000004C53D.",

		"12/11 12:40:06.593  ZONE_INFO: 11.12.25 12:52:59&blackrock spire&0",
		"12/11 12:40:06.593  UNIT_INFO: 11.12.25 12:40:06&0xF130001CF827939E&0&Mana Spring Totem IV&1&0x00000000000C270C&,10494=1`",
		"12/11 12:40:06.593  COMBATANT_INFO: 11.12.25 12:54:23&Maldrissa&WARLOCK&Orc&3&Chotuk&Exalted with Doordash&Uber Eats&5&nil&nil&nil&nil&6266:0:96:0&nil&6568:0:237:0&4915:0:0:0&nil&nil&nil&nil&nil&nil&4695:0:0:0&4925:0:0:0&nil&11287:0:0:0&5976:0:0:0&nil&0x00000000000EB167&0xF140084493000003",
		"12/11 12:40:06.593  0x00000000000C270C casts Mana Spring Totem.",
		"12/11 12:40:06.593  CAST: 0x00000000000C270C(Noflex) casts Mana Spring Totem(10497)(Rank 4).",
		"12/11 12:40:06.593  CAST: 0xF130001CF827939E(Mana Spring Totem IV) casts Mana Spring(10494)(Rank 4) on 0xF130001CF827939E(Mana Spring Totem IV).",

		"12/11 12:40:06.710  Holy Strength fades from 0x000000000009AC69.",
		"12/11 12:40:07.015  CAST: 0x00000000000C270C(Noflex) casts Strength of Earth Totem(10442)(Rank 4).",
		"12/11 12:40:07.015  CAST: 0xF130001CEB27939F(Strength of Earth Totem IV) casts Strength of Earth(10441)(Rank 4) on 0xF130001CEB27939F(Strength of Earth Totem IV).",
	}

	// Shuffles the inputs randomly to ensure sorting works correctly
	for i := 0; i < 10; i++ {
		cpy := slices.Clone(logs)
		rand.Shuffle(len(cpy), func(i, j int) { cpy[i], cpy[j] = cpy[j], cpy[i] })

		logger := testutil.Logger(t)
		var out bytes.Buffer
		_, err := sorter.SortLogs(t.Context(), logger, strings.NewReader(strings.Join(cpy, "\n")), &out)
		require.NoError(t, err)

		t.Log(out.String())
		got := strings.Split(out.String(), "\n")
		require.Equal(t, logs, removeEmpty(got))
	}
}

func removeEmpty(lines []string) []string {
	cpy := make([]string, 0, len(lines))
	for _, line := range lines {
		if strings.TrimSpace(line) != "" {
			cpy = append(cpy, line)
		}
	}
	return cpy
}
