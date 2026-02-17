package chrondbc_test

import (
	"encoding/json"
	"testing"

	"github.com/Emyrk/chronicle/database/gamedb/chrondbc"
	"github.com/stretchr/testify/require"
)

func TestSpellClassMask(t *testing.T) {
	t.Parallel()

	require.Equal(t, chrondbc.NewSpellClassMask(1, 0), chrondbc.SpellClassMask(1))

	d, _ := json.Marshal((chrondbc.ProcExCriticalHit | chrondbc.ProcExNormalHit))
	require.JSONEq(t, string(d), `{"mask":3,"string":"ProcExNormalHit | ProcExCriticalHit"}`)
}
