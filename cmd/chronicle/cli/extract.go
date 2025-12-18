package cli

import (
	"bufio"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/Emyrk/chronicle/combatlog/parser/lines"

	"github.com/coder/serpent"
)

func ExtractCmd() *serpent.Command {
	cmd := &serpent.Command{
		Use: "extract <file>",
		Children: []*serpent.Command{
			ExtractByTime(),
		},
	}

	return cmd
}

func ExtractByTime() *serpent.Command {
	var (
		begin  string
		end    string
		useUTC bool
	)
	cmd := &serpent.Command{
		// chronicle extract by-time ignoredlogs/raid/WoWRawCombatLog.txt --start 14:12:40 --end 14:15:18
		Use: "by-time <file>",
		Options: serpent.OptionSet{
			{
				Name:        "use-utc",
				Description: "Interpret begin and end times as UTC instead of local time.",
				Required:    false,
				Flag:        "use-utc",
				Value:       serpent.BoolOf(&useUTC),
			},
			{
				Name:        "begin",
				Description: "Start time for extraction (inclusive).",
				Required:    true,
				Flag:        "begin",
				Value:       serpent.StringOf(&begin),
			},
			{
				Name:        "end",
				Description: "End time for extraction (exclusive).",
				Required:    true,
				Flag:        "end",
				Value:       serpent.StringOf(&end),
			},
		},
		Handler: func(i *serpent.Invocation) error {
			ctx := i.Context()
			logger := getLogger(i)

			loc := time.Local
			if useUTC {
				loc = time.UTC
			}

			setDate := sync.Once{}
			start, err := time.ParseInLocation("15:04:05", begin, loc)
			if err != nil {
				return fmt.Errorf("invalid begin time format: %w", err)
			}
			finish, err := time.ParseInLocation("15:04:05", end, loc)
			if err != nil {
				return fmt.Errorf("invalid end time format: %w", err)
			}

			files, err := openFileReaders(i.Args[0])
			if err != nil {
				return err
			}
			defer func() { closeFiles(files...) }()
			input := bufio.NewScanner(files[0])

			liner := lines.NewLiner()
			for input.Scan() {
				if ctx.Err() != nil {
					return ctx.Err()
				}

				txt := input.Text()
				ts, content, err := liner.Line(txt)
				if err != nil {
					logger.Warn("skipping failed line", slog.String("line", txt), slog.String("error", err.Error()))
					continue
				}

				setDate.Do(func() {
					year, month, day := ts.Date()
					start = time.Date(year, month, day, start.Hour(), start.Minute(), start.Second(), 0, loc)
					finish = time.Date(year, month, day, finish.Hour(), finish.Minute(), finish.Second(), 0, loc)
				})

				if ts.Before(start) {
					continue
				}

				if ts.After(finish) {
					logger.Info("extraction complete", slog.Time("end_time", ts))
					break
				}

				_, _ = fmt.Fprintln(i.Stdout, liner.FmtLine(ts, content))
			}

			return nil
		},
	}
	return cmd
}
