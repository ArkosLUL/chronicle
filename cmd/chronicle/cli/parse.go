package cli

import (
	"fmt"
	"log/slog"
	"time"

	"github.com/Emyrk/chronicle/combatlog/consumers"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/creatures"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters"

	"github.com/coder/serpent"
)

func ParseCmd() *serpent.Command {
	var (
		dumpMetrics bool
	)
	profileOpt, profileMW := ProfileCommand()
	cmd := &serpent.Command{
		Use:        "parse <file> <file>",
		Middleware: serpent.Chain(serpent.RequireNArgs(2), profileMW),
		Options: serpent.OptionSet{
			profileOpt,
			{
				Name:        "dump-metrics",
				Description: "Print metrics information after parsing.",
				Required:    false,
				Flag:        "metrics",
				Value:       serpent.BoolOf(&dumpMetrics),
			},
		},
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
			output := encounters.New(logger)
			c := consumers.New(logger, output)
			err = c.ConsumeAll(ctx, p)
			if err != nil {
				return err
			}

			for _, inst := range output.Instances {
				logger.Info("Parsed instance",
					slog.String("name", inst.Name()),
				)

				for _, f := range inst.Fights() {
					fmt.Println(f.NamedString(output.Units))
				}
			}

			consumerLog := logger.With("component", "consumers")
			for k, v := range c.Times() {
				consumerLog = consumerLog.With(slog.String(k+"_duration", v.String()))
			}
			consumerLog.Info("Consumer processing times")

			mets := p.Metrics()
			logger.Info("Parsing complete",
				slog.Int64("total_lines_parsed", mets.TotalLinesParsed),
				slog.String("total_parse_duration", mets.TotalParseDuration.String()),
				slog.String("average_line_parse_duration", (mets.TotalParseDuration/time.Duration(mets.TotalLinesParsed)).String()),
				slog.String("total_unmatched_time", mets.UnmatchedTime.String()),
			)
			if dumpMetrics {
				fmt.Println(mets.Format())
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
					fmt.Printf("  %d: %q,\n", id, name)
				}
				fmt.Println()
			}

			return nil
		},
	}

	return cmd
}
