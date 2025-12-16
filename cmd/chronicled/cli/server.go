package cli

import (
	"github.com/coder/serpent"
)

func ServerCmd() *serpent.Command {
	cmd := &serpent.Command{
		Use:     "server",
		Options: []serpent.Option{},
		Handler: func(i *serpent.Invocation) error {

			return nil
		},
	}
	return cmd
}
