package cli

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/Emyrk/chronicle/database"
	"github.com/Emyrk/chronicle/database/gamedb/dbc"
	"github.com/Emyrk/chronicle/scripts/dbcdata/dbcdb"
	"github.com/Gophercraft/core/format/dbc/dbdefs"
	"github.com/Gophercraft/core/i18n"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/coder/serpent"
)

func Populate() *serpent.Command {
	var (
		dbURL   string
		dbcPath string
		verbose bool
	)

	return &serpent.Command{
		Use:   "populate",
		Short: "Load WoW game data from DBC files into the database.",
		Options: serpent.OptionSet{
			{
				Name:        "db",
				Description: "PostgreSQL connection URL.",
				Flag:        "db",
				Env:         "DATABASE_URL",
				Value:       serpent.StringOf(&dbURL),
				Required:    true,
			},
			{
				Name:        "dbc",
				Description: "Path to WoW client directory (containing Data folder).",
				Flag:        "dbc",
				Value:       serpent.StringOf(&dbcPath),
				Required:    true,
			},
			{
				Name:          "verbose",
				Description:   "Print verbose output.",
				Flag:          "verbose",
				FlagShorthand: "v",
				Value:         serpent.BoolOf(&verbose),
			},
		},
		Handler: func(inv *serpent.Invocation) error {
			ctx := inv.Context()
			logger := slog.New(slog.NewTextHandler(inv.Stderr, &slog.HandlerOptions{
				Level: slog.LevelInfo,
			}))
			if verbose {
				logger = slog.New(slog.NewTextHandler(inv.Stderr, &slog.HandlerOptions{
					Level: slog.LevelDebug,
				}))
			}

			// Connect to database
			logger.Info("connecting to database")
			pool, err := database.NewPostgresDB(ctx, logger, dbURL)
			if err != nil {
				return fmt.Errorf("connect to database: %w", err)
			}
			defer pool.Close()
			store := database.New(pool)

			// Open WoW client
			logger.Info("opening WoW client", "path", dbcPath)
			wc, err := dbcdb.New(dbcPath)
			if err != nil {
				return fmt.Errorf("open wow client: %w", err)
			}

			// Load spells
			if err := loadSpells(ctx, logger, store, wc); err != nil {
				return fmt.Errorf("load spells: %w", err)
			}

			logger.Info("populate complete")
			return nil
		},
	}
}

func loadSpells(ctx context.Context, logger *slog.Logger, store database.Store, wc *dbcdb.WoWClient) error {
	logger.Info("loading spells from DBC")

	spellTable, err := wc.Spells()
	if err != nil {
		return fmt.Errorf("read spells: %w", err)
	}

	total := spellTable.Len()
	logger.Info("found spells in DBC", "count", total)

	// Collect all spells
	var spells []*dbc.Spell
	err = spellTable.Range(func(cursor *dbdefs.Ent_Spell) bool {
		if cursor == nil {
			return true
		}
		spells = append(spells, dbc.NewSpell(*cursor))
		return true
	})
	if err != nil {
		return fmt.Errorf("iterate spells: %w", err)
	}

	// Batch upsert
	const batchSize = 500
	start := time.Now()
	for i := 0; i < len(spells); i += batchSize {
		end := i + batchSize
		if end > len(spells) {
			end = len(spells)
		}
		batch := spells[i:end]

		if err := upsertSpellBatch(ctx, store, batch); err != nil {
			return fmt.Errorf("upsert batch %d-%d: %w", i, end, err)
		}

		logger.Debug("upserted spells", "progress", end, "total", len(spells))
	}

	logger.Info("loaded spells", "count", len(spells), "duration", time.Since(start))
	return nil
}

func upsertSpellBatch(ctx context.Context, store database.Store, spells []*dbc.Spell) error {
	return store.InTx(func(store database.Store) error {
		for _, sp := range spells {
			params := spellToParams(sp)
			if err := store.UpsertSpellTemplate(ctx, params); err != nil {
				return fmt.Errorf("upsert spell %d (%s): %w", sp.ID, sp.Name_lang.String(), err)
			}
		}
		return nil
	}, &pgx.TxOptions{})
}

func spellToParams(sp *dbc.Spell) database.UpsertSpellTemplateParams {
	// Convert attributes [9]uint32 → []int64
	attrs := make([]int64, len(sp.Attrs))
	for i, v := range sp.Attrs {
		attrs[i] = int64(v)
	}

	return database.UpsertSpellTemplateParams{
		//ID:   sp.ID,
		//Name: sp.Name_lang.String(),
		////School:          schoolFromMask(sp.SchoolMask),
		//Description:     textToPgtype(sp.Description_lang),
		//Subtext:         textToPgtype(sp.NameSubtext_lang),
		//AuraDescription: textToPgtype(sp.AuraDescription_lang),
		//IconID:          pgtype.Int4{Int32: sp.SpellIconID, Valid: true},
		////SchoolMask:      pgtype.Int4{Int32: sp.SchoolMask, Valid: true},
		//PowerType:     pgtype.Int4{Int32: sp.PowerType, Valid: true},
		//ManaCost:      pgtype.Int4{Int32: sp.ManaCost, Valid: true},
		//ManaCostPct:   pgtype.Int4{Int32: sp.ManaCostPct, Valid: true},
		//CastTimeIndex: pgtype.Int4{Int32: sp.CastingTimeIndex, Valid: true},
		//RecoveryTime:  pgtype.Int4{Int32: sp.RecoveryTime, Valid: true},
		//RangeIndex:    pgtype.Int4{Int32: sp.RangeIndex, Valid: true},
		//Attributes:    attrs,
		//Targets:       pgtype.Int4{Int32: int32(sp.Targets), Valid: true},
	}
}

func textToPgtype(t i18n.Text) pgtype.Text {
	s := t.String()
	return pgtype.Text{String: s, Valid: s != ""}
}

// schoolFromMask converts a school bitmask to the primary school enum.
// School bitmask: 1=physical, 2=holy, 4=fire, 8=nature, 16=frost, 32=shadow, 64=arcane
func schoolFromMask(mask int32) database.SpellSchool {
	switch {
	case mask&4 != 0:
		return database.SpellSchoolFire
	case mask&16 != 0:
		return database.SpellSchoolFrost
	case mask&32 != 0:
		return database.SpellSchoolShadow
	case mask&64 != 0:
		return database.SpellSchoolArcane
	case mask&2 != 0:
		return database.SpellSchoolHoly
	case mask&8 != 0:
		return database.SpellSchoolNature
	default:
		return database.SpellSchoolPhysical
	}
}
