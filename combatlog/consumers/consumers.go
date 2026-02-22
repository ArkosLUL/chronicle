package consumers

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"time"

	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/parseerrors"
)

type Consumer interface {
	Process(m messages.Message) error
}

type Consumers struct {
	logger *slog.Logger
	list   []Consumer

	time map[string]time.Duration
}

func New(logger *slog.Logger, consumers ...Consumer) *Consumers {
	return &Consumers{
		logger: logger,
		list:   consumers,
		time:   make(map[string]time.Duration),
	}
}

func (c Consumers) Times() map[string]time.Duration {
	return c.time
}

type Advancer interface {
	Advance(ctx context.Context) ([]messages.Message, error)
}

func (c Consumers) ConsumeAll(ctx context.Context, p Advancer) error {
	for {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		_, err := c.Advance(ctx, p)
		if err != nil {
			if errors.Is(err, io.EOF) {
				return nil
			}
			return err
		}
	}
}

func (c Consumers) Advance(ctx context.Context, p Advancer) ([]messages.Message, error) {
	now := time.Now()
	msgs, err := p.Advance(ctx)
	c.time["parser"] += time.Since(now)
	if err != nil {
		if parseerrors.IsFatalError(err) {
			return nil, fmt.Errorf("fatal parser error: %w", err)
		}
		if errors.Is(err, io.EOF) {
			return nil, io.EOF
		}
		c.logger.Error("Error advancing parser", slog.String("error", err.Error()))
	}

	for _, msg := range msgs {
		for _, consumer := range c.list {
			now := time.Now()
			err = consumer.Process(msg)
			c.time[fmt.Sprintf("%T", consumer)] += time.Since(now)
			if err != nil {
				return nil, fmt.Errorf("consumer process: %w", err)
			}
		}
	}

	return msgs, nil
}
