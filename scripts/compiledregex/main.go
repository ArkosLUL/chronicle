package main

import (
	"flag"
	"fmt"
	"regexp"

	"github.com/Emyrk/chronicle/combatlog/parser/regexs"
	"github.com/KromDaniel/regengo"
)

// Optimizing regex performance by compiling frequently used regex patterns into Go code.
func main() {
	var (
		outFile = flag.String("output", "compiled.go", "Output file for the compiled regex Go code.")
		pkg     = flag.String("package", "compiled", "Package name for the compiled regex Go code.")
	)
	flag.Parse()

	compile := map[string]*regexp.Regexp{
		"ReSpellCastAttempt":        regexs.ReSpellCastAttempt,
		"ReBugDamageSpellHitOrCrit": regexs.ReBugDamageSpellHitOrCrit,
	}

	for name, pattern := range compile {
		err := regengo.Compile(regengo.Options{
			Pattern:    pattern.String(),
			Name:       name,
			OutputFile: *outFile,
			Package:    *pkg,
		})
		if err != nil {
			panic(fmt.Sprintf("%s: %s", name, err.Error()))
		}
	}
}
