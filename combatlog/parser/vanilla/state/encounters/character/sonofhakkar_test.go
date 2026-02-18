package character_test

import (
	"errors"
	"io"
	"os"
	"testing"

	"github.com/Emyrk/chronicle/combatlog/parser/logfile"
	"github.com/Emyrk/chronicle/combatlog/parser/merge"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters"
	"github.com/Emyrk/chronicle/internal/testutil"
	"github.com/stretchr/testify/require"
)

func TestSonOfHakkar(t *testing.T) {
	t.Parallel()
	t.Skip("Not done")

	raw, err := os.OpenFile("testdata/sonofhakker/WoWRawCombatLog.txt", os.O_RDONLY, 0644)
	require.NoError(t, err)
	logs, err := os.OpenFile("testdata/sonofhakker/WoWCombatLog.txt", os.O_RDONLY, 0644)
	require.NoError(t, err)

	ctx := testutil.Context(t, testutil.WaitSuperLong)
	logger := testutil.Logger(t)

	m := merge.NewMerger(logger)
	liner, scans, err := m.LineScanner(ctx, nil, logfile.New(nil, raw), logfile.New(nil, logs))
	require.NoError(t, err)

	p := vanilla.NewFromScanner(logger, liner, scans)
	output := encounters.New(logger)
	for {
		msgs, err := p.Advance()
		if errors.Is(err, io.EOF) {
			break
		}
		require.NoError(t, err)

		for _, msg := range msgs {
			err = output.Process(msg)
			require.NoError(t, err)
		}
	}

	// Analyze the results here as needed.
	fights := output.CurrentInstance.Fights()
	require.Len(t, fights, 2)
}
