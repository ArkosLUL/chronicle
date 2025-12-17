package testutil

import (
	"context"
	"io"
	"log/slog"
	"testing"
	"time"

	"github.com/rs/zerolog"
	slogzerolog "github.com/samber/slog-zerolog/v2"
)

type options struct {
	writers []io.Writer
}

type LoggerOpt func(opt *options)

func WithWriter(w io.Writer) LoggerOpt {
	return func(opt *options) {
		opt.writers = append(opt.writers, w)
	}
}

func Logger(t zerolog.TestingLog, opts ...LoggerOpt) *slog.Logger {
	config := &options{}
	for _, opt := range opts {
		opt(config)
	}

	primary := zerolog.NewConsoleWriter(zerolog.ConsoleTestWriter(t))
	output := zerolog.MultiLevelWriter(append([]io.Writer{primary}, config.writers...)...)

	zerologLogger := zerolog.New(output)
	logger := slog.New(slogzerolog.Option{Level: slog.LevelDebug, Logger: &zerologLogger}.NewZerologHandler())
	return logger
}

// Constants for timing out operations, usable for creating contexts
// that timeout or in require.Eventually.
const (
	WaitShort     = 10 * time.Second
	WaitMedium    = 15 * time.Second
	WaitLong      = 25 * time.Second
	WaitSuperLong = 60 * time.Second
)

// Constants for delaying repeated operations, e.g. in
// require.Eventually.
const (
	IntervalFast   = 25 * time.Millisecond
	IntervalMedium = 250 * time.Millisecond
	IntervalSlow   = time.Second
)

func Context(t testing.TB, dur time.Duration) context.Context {
	ctx, cancel := context.WithTimeout(t.Context(), dur)
	t.Cleanup(cancel)
	return ctx
}
