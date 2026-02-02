package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/Emyrk/chronicle/database/spice/policy"
	"github.com/Emyrk/chronicle/scripts/policygen/gen"
)

var destination = flag.String("destination", "", "destination file")

func main() {
	flag.Parse()

	out, err := gen.Generate(policy.Schema, gen.GenerateOptions{
		Filename: "schema.zed",
		Package:  "policy",
	})
	if err != nil {
		fmt.Fprint(os.Stderr, err.Error())
		os.Exit(1)
	}

	if *destination == "" {
		fmt.Println(out)
		return
	}

	fmt.Println("Writing to", *destination)
	_ = os.Remove(*destination)
	err = os.WriteFile(*destination, []byte(out), 0644)
	if err != nil {
		fmt.Fprint(os.Stderr, err.Error())
		os.Exit(1)
	}
}
