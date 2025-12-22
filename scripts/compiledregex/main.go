package main

import (
	"flag"
	"fmt"
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
	}

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
	}
}
