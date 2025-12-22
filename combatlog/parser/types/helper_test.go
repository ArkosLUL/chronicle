package types_test

import (
	"regexp"
	"testing"

	"github.com/Emyrk/chronicle/combatlog/parser/regexs"
	"github.com/Emyrk/chronicle/combatlog/parser/regexs/compiled"
	"github.com/Emyrk/chronicle/combatlog/parser/types"
	"github.com/stretchr/testify/require"
)

func TestMatchStack(t *testing.T) {
	t.Parallel()

	re := regexp.MustCompile(`(hello) (world) (\d+)`)
	p := types.FromRegex(re)
	content := "hello world 1234"

	matched, ok := p.Match(content)
	require.True(t, ok)
	require.Equal(t, "hello", matched.String())
	require.Equal(t, "world", matched.String())
	require.Equal(t, "1234", matched.String())
	require.Nil(t, matched.Error())

	matched, ok = p.Match(content)
	require.True(t, ok)
	require.Equal(t, []string{"hello", "world", "1234"}, matched.Rest())
}

func TestCompiled(t *testing.T) {
	p := types.FromRegex(regexs.ReCreates)
	c := types.FromCompiled[*compiled.ReCreatesResult](compiled.CompiledReCreates)

	t.Run("Match", func(t *testing.T) {
		a, aok := p.Match("Doyd creates new money.")
		b, bok := c.Match("Doyd creates new money.")
		require.Equal(t, aok, bok)

		require.Equal(t, a.Values, b.Values)

		require.Equal(t, a.String(), "Doyd")
		require.Equal(t, a.String(), "new money")

		require.Equal(t, b.String(), "Doyd")
		require.Equal(t, b.String(), "new money")
	})
}
