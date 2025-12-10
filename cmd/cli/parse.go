package cli

import (
	"log/slog"

	"github.com/Emyrk/chronicle/combatlog/parser/vanilla"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state"

	"github.com/coder/serpent"
)

func ParseCmd() *serpent.Command {
	cmd := &serpent.Command{
		Use:        "parse <file> <file>",
		Middleware: serpent.RequireNArgs(2),
		Handler: func(i *serpent.Invocation) error {
			ctx := i.Context()
			logger := getLogger(i)

			files, err := openFileReaders(i.Args[0], i.Args[1])
			if err != nil {
				return err
			}
			defer func() { closeFiles(files...) }()

			m := vanilla.Merger(logger)
			liner, scan, err := m.LineScanner(ctx, files[0], files[1])
			if err != nil {
				return err
			}

			p := vanilla.NewFromScanner(logger, liner, scan)
			output := state.New(logger)
			err = output.Consume(ctx, p)
			if err != nil {
				return err
			}

			for _, inst := range output.Instances {
				logger.Info("Parsed instance",
					slog.String("name", inst.Name()),
				)
			}

			return nil
		},
	}

	return cmd
}
