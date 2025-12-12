package cli

import (
	"errors"
	"fmt"
	"log/slog"

	"github.com/Emyrk/chronicle/combatlog/parser/vanilla"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/creatures"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters/fight"

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

				fights, diags := fight.AggregateFights(inst)
				if diags.HasErrors() {
					return errors.Join(diags.Errs()...)
				}

				for _, diag := range diags {
					logger.Warn("Fight aggregation diagnostic",
						slog.String("summary", diag.Summary),
						slog.String("details", diag.Detail),
					)
				}
				for _, f := range fights {
					fmt.Println(f.NamedString(output.Units))
				}
			}

			return nil
		},
	}

	return cmd
}

func CreaturesCmd() *serpent.Command {
	cmd := &serpent.Command{
		Use:        "creatures <file> <file>",
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
			output := creatures.New(logger)
			err = output.Consume(ctx, p)
			if err != nil {
				return err
			}

			for z, units := range output.ZonedUnits {
				fmt.Println("Zone:", z)
				for id, name := range units {
					fmt.Printf("  ID: %d, Name: %s\n", id, name)
				}
				fmt.Println()
			}

			return nil
		},
	}

	return cmd
}
