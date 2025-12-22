package matchers

import (
	"github.com/Emyrk/chronicle/combatlog/parser/regexs/compiled"
	"github.com/Emyrk/chronicle/combatlog/parser/types"
)

func ReSpellCastAttempt() *types.Pattern {
	return types.FromCompiled[*compiled.ReSpellCastAttemptResult](compiled.CompiledReSpellCastAttempt)
}

func ReBugDamageSpellHitOrCrit() *types.Pattern {
	return types.FromCompiled[*compiled.ReBugDamageSpellHitOrCritResult](compiled.CompiledReBugDamageSpellHitOrCrit)
}

func ReCreates() *types.Pattern {
	return types.FromCompiled[*compiled.ReCreatesResult](compiled.CompiledReCreates)
}

func ReGain() *types.Pattern {
	return types.FromCompiled[*compiled.ReGainResult](compiled.CompiledReGain)
}
