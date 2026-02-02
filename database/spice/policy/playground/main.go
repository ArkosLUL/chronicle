package main

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"

	"github.com/Emyrk/chronicle/database/spice/policy"
	"github.com/Emyrk/chronicle/database/spice/policy/playground/relationships"
)

func main() {
	if len(os.Args) <= 1 {
		usage()
		return
	}

	switch os.Args[1] {
	case "export":
		fmt.Println(PlaygroundExport())
	default:
		usage()
	}
}

func usage() {
	fmt.Println("Usage: policycmd [command]")
	fmt.Println("Commands:")
	fmt.Println("  export")
	// fmt.Println("  import")
	//fmt.Println("  playground")
	//fmt.Println("  run")
	//fmt.Println("  test")
}

type AssertStruct struct {
	True  []string `yaml:"assertTrue"`
	False []string `yaml:"assertFalse"`
}

type PlaygroundYAML struct {
	Schema        string              `yaml:"schema"`
	Relationships string              `yaml:"relationships"`
	Assertions    AssertStruct        `yaml:"assertions"`
	Validation    map[string][]string `yaml:"validation"`
}

func PlaygroundExport() string {
	relationships.GenerateRelationships()
	y := PlaygroundYAML{
		Schema:        policy.Schema,
		Relationships: relationships.RelationshipsToCSV(relationships.Playground.Builder.Relationships),
		Assertions: AssertStruct{
			True:  relationships.RelationshipsToStrings(relationships.Playground.True),
			False: relationships.RelationshipsToStrings(relationships.Playground.False),
		},
		Validation: relationships.ExportValidations(relationships.Playground.Validations),
	}
	out, err := yaml.Marshal(y)
	if err != nil {
		panic(err)
	}
	return string(out)
}
