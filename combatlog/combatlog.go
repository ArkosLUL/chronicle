package combatlog

import (
	"context"
	"fmt"
	"io"
	"log/slog"

	"github.com/Emyrk/chronicle/combatlog/consumers"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/damagemetric"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters/instances"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/unitdb"
)

type Output struct {
	// Units spans all instances
	Units *unitdb.Units

	Instances map[string]InstanceOutput
}

type InstanceOutput struct {
	Encounters     []instances.Encounter
	DamageTracking *damagemetric.Damage
}

func CombatLogs(ctx context.Context, logger *slog.Logger, formatted, raw io.Reader) (*Output, error) {
	m := vanilla.Merger(logger)
	liner, scan, err := m.LineScanner(ctx, formatted, raw)
	if err != nil {
		return nil, fmt.Errorf("create line scanner: %w", err)
	}

	output := Output{
		Instances: make(map[string]InstanceOutput),
	}
	p := vanilla.NewFromScanner(logger, liner, scan)

	// Encounters/Fights
	enc := encounters.New(logger)
	dmg := damagemetric.New()

	c := consumers.New(logger, enc, dmg)
	err = c.ConsumeAll(ctx, p)
	if err != nil {
		return nil, fmt.Errorf("consume all: %w", err)
	}

	// Take the DB from the encounters consumer
	output.Units = enc.Units

	// Aggregation from consumers. This output needs to be stored somewhere.
	for _, inst := range enc.Instances {
		key := inst.Zone().ID()
		finalized, err := inst.Finalize(ctx)
		if err != nil {
			return nil, fmt.Errorf("finalize instance: %w", err)
		}

		output.Instances[key] = InstanceOutput{
			Encounters:     finalized.Encounters,
			DamageTracking: dmg,
		}
	}

	return &output, nil
}
