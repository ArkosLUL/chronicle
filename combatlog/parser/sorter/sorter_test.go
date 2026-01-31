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

// TestSortByTimestamp verifies that lines are sorted primarily by timestamp.
func TestSortByTimestamp(t *testing.T) {
	t.Parallel()

	logs := []string{
		"12/11 12:40:06.392  First event.",
		"12/11 12:40:06.549  Second event.",
		"12/11 12:40:06.710  Third event.",
		"12/11 12:40:07.015  Fourth event.",
	}

	// Shuffle and verify timestamp ordering is preserved
	for i := 0; i < 10; i++ {
		cpy := slices.Clone(logs)
		rand.Shuffle(len(cpy), func(i, j int) { cpy[i], cpy[j] = cpy[j], cpy[i] })

		logger := testutil.Logger(t)
		var out bytes.Buffer
		_, _, err := sorter.SortLogs(t.Context(), logger, strings.NewReader(strings.Join(cpy, "\n")), &out)
		require.NoError(t, err)

		got := removeEmpty(strings.Split(out.String(), "\n"))
		require.Equal(t, logs, got)
	}
}

// TestPriorityOrder verifies that at the same timestamp:
// 1. ZONE_INFO comes first
// 2. UNIT_INFO comes second
// 3. COMBATANT_INFO comes third
// 4. Other lines maintain their original input order
func TestPriorityOrder(t *testing.T) {
	t.Parallel()

	// All lines have the same timestamp - order should be deterministic based on type priority
	logs := []string{
		"12/11 12:40:06.593  ZONE_INFO: 11.12.25 12:52:59&blackrock spire&0",
		"12/11 12:40:06.593  UNIT_INFO: 11.12.25 12:40:06&0xF130001CF827939E&0&Mana Spring Totem IV&1&0x00000000000C270C&,10494=1`",
		"12/11 12:40:06.593  COMBATANT_INFO: 11.12.25 12:54:23&Maldrissa&WARLOCK&Orc&3&Chotuk&Exalted&5&nil",
		"12/11 12:40:06.593  Some regular event.",
	}

	// Shuffle and verify priority ordering
	for i := 0; i < 10; i++ {
		cpy := slices.Clone(logs)
		rand.Shuffle(len(cpy), func(i, j int) { cpy[i], cpy[j] = cpy[j], cpy[i] })

		logger := testutil.Logger(t)
		var out bytes.Buffer
		_, _, err := sorter.SortLogs(t.Context(), logger, strings.NewReader(strings.Join(cpy, "\n")), &out)
		require.NoError(t, err)

		got := removeEmpty(strings.Split(out.String(), "\n"))
		require.Equal(t, logs, got)
	}
}

// TestOriginalOrderPreserved verifies that lines with the same timestamp and no
// special priority maintain their original input order.
func TestOriginalOrderPreserved(t *testing.T) {
	t.Parallel()

	// All same timestamp, no priority types - should maintain input order
	logs := []string{
		"12/11 12:40:06.593  First regular event.",
		"12/11 12:40:06.593  Second regular event.",
		"12/11 12:40:06.593  Third regular event.",
		"12/11 12:40:06.593  Fourth regular event.",
	}

	// Without shuffling, order should be preserved
	logger := testutil.Logger(t)
	var out bytes.Buffer
	_, _, err := sorter.SortLogs(t.Context(), logger, strings.NewReader(strings.Join(logs, "\n")), &out)
	require.NoError(t, err)

	got := removeEmpty(strings.Split(out.String(), "\n"))
	require.Equal(t, logs, got)
}

// TestMixedTimestampsAndPriorities tests a realistic scenario with multiple
// timestamps and priority types.
func TestMixedTimestampsAndPriorities(t *testing.T) {
	t.Parallel()

	// Input in the order we'll provide it (not shuffled for this test)
	input := []string{
		"12/11 12:40:06.593  Regular event A.",
		"12/11 12:40:06.593  ZONE_INFO: 11.12.25 12:52:59&blackrock spire&0",
		"12/11 12:40:06.593  Regular event B.",
		"12/11 12:40:06.593  UNIT_INFO: 11.12.25 12:40:06&0xF130001CF827939E&0&Mana Spring&1&0x00000000000C270C&,10494=1`",
	}

	// Expected: ZONE_INFO first, then UNIT_INFO, then regular events in original order
	expected := []string{
		"12/11 12:40:06.593  ZONE_INFO: 11.12.25 12:52:59&blackrock spire&0",
		"12/11 12:40:06.593  UNIT_INFO: 11.12.25 12:40:06&0xF130001CF827939E&0&Mana Spring&1&0x00000000000C270C&,10494=1`",
		"12/11 12:40:06.593  Regular event A.",
		"12/11 12:40:06.593  Regular event B.",
	}

	logger := testutil.Logger(t)
	var out bytes.Buffer
	_, _, err := sorter.SortLogs(t.Context(), logger, strings.NewReader(strings.Join(input, "\n")), &out)
	require.NoError(t, err)

	got := removeEmpty(strings.Split(out.String(), "\n"))
	require.Equal(t, expected, got)
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
