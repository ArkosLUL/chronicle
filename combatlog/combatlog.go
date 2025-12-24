package combatlog

import (
  "context"
  "errors"
  "fmt"
  "io"
  "log/slog"

  "github.com/Emyrk/chronicle/combatlog/consumers"
  "github.com/Emyrk/chronicle/combatlog/parser/vanilla"
  "github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters"
  "github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters/fight"
)

type Output struct {
  Fights map[string][]fight.Fight
}

func CombatLogs(ctx context.Context, logger *slog.Logger, formatted, raw io.Reader) (*Output, error) {
  m := vanilla.Merger(logger)
  liner, scan, err := m.LineScanner(ctx, formatted, raw)
  if err != nil {
    return nil, fmt.Errorf("create line scanner: %w", err)
  }

  output := Output{
    Fights: make(map[string][]fight.Fight),
  }
  p := vanilla.NewFromScanner(logger, liner, scan)

  // Encounters/Fights
  enc := encounters.New(logger)

  c := consumers.New(logger, enc)
  err = c.ConsumeAll(ctx, p)
  if err != nil {
    return nil, fmt.Errorf("consume all: %w", err)
  }

  // Aggregation
  for _, inst := range enc.Instances {
    fights, diags := fight.AggregateFights(inst)
    if diags.HasErrors() {
      return nil, errors.Join(diags.Errs()...)
    }

    output.Fights[inst.Name()] = append(output.Fights[inst.Name()], fights...)
  }

  return &output, nil
}
