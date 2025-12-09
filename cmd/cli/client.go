package cli

import (
	"fmt"
	"os"

	"github.com/Gophercraft/core/format/content"

	"github.com/coder/serpent"
)

func ClientFiles() *serpent.Command {
	cmd := &serpent.Command{
		Use:        "client <wow_path>",
		Middleware: serpent.RequireNArgs(1),
		Options:    []serpent.Option{},
		Handler: func(i *serpent.Invocation) error {
			path := i.Args[0]

			_, _ = fmt.Fprintf(os.Stdout, "Opening WoW path: %s\n", path)
			vol, err := content.Open(path)
			if err != nil {
				return fmt.Errorf("opening wow path %s: %w", path, err)
			}

			fmt.Println(vol.Build())
			return nil
		},
	}
	return cmd
}
