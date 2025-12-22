package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/Emyrk/chronicle/combatlog/parser/regexs"
	"github.com/KromDaniel/regengo"
)

// Optimizing regex performance by compiling frequently used regex patterns into Go code.
func main() {
	var (
		outDir = flag.String("output", ".", "Output directory for the compiled regex Go code.")
		pkg    = flag.String("package", "compiled", "Package name for the compiled regex Go code.")
	)
	flag.Parse()

	compile := map[string]*regexp.Regexp{
		"ReSpellCastAttempt":        regexs.ReSpellCastAttempt,
		"ReBugDamageSpellHitOrCrit": regexs.ReBugDamageSpellHitOrCrit,
		"ReCreates":                 regexs.ReCreates,
		"ReGain":                    regexs.ReGain,
	}

	var out strings.Builder
	out.WriteString("package matchers \n\n")
	out.WriteString(`import (
  "github.com/Emyrk/chronicle/combatlog/parser/regexs/compiled"
  "github.com/Emyrk/chronicle/combatlog/parser/types"
)`)
	out.WriteString("\n\n")
	for name, pattern := range compile {
		err := regengo.Compile(regengo.Options{
			Pattern:    pattern.String(),
			Name:       name,
			OutputFile: filepath.Join(*outDir, strings.ToLower(name)+".go"),
			Package:    *pkg,
		})
		if err != nil {
			panic(fmt.Sprintf("%s: %s", name, err.Error()))
		}

		out.WriteString(fmt.Sprintf(`func %[1]s() *types.Pattern {
  return types.FromCompiled[*compiled.%[1]sResult](compiled.Compiled%[1]s)
}`, name))
		out.WriteString("\n\n")
	}

	path := filepath.Join(*outDir, "matchers", "compiled.go")
	os.MkdirAll(filepath.Dir(path), 0755)
	err := os.WriteFile(path, []byte(out.String()), 0644)
	if err != nil {
		panic(err)
	}
}
