package leveledlog

import (
	"context"
	"log/slog"
)

func New(logger *slog.Logger, level slog.Leveler) *slog.Logger {
	return slog.New(&Leveled{
		level:   level,
		Handler: logger.Handler(),
	})
}

type Leveled struct {
	level slog.Leveler
	slog.Handler
}

func (h *Leveled) Enabled(_ context.Context, level slog.Level) bool {
	return level >= h.level.Level()
}
