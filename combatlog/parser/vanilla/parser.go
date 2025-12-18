package vanilla

import (
	"fmt"
	"io"
	"log/slog"
	"reflect"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/Emyrk/chronicle/combatlog/parser/lines"
	"github.com/Emyrk/chronicle/combatlog/parser/merge"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/messages"
	"github.com/Emyrk/chronicle/combatlog/parser/vanilla/whoami"
)

type parseLine = func(ts time.Time, content string) ([]messages.Message, error)

type Parser struct {
	logger  *slog.Logger
	scanner merge.Scan
	liner   *lines.Liner
	//state   *state.State
	you *youReplacer

	setup       sync.Once
	lastLogDate time.Time

	metrics Metrics
	// Used for human readable metrics output
	matchers     []parseLine
	matcherNames []string
	initMatchers sync.Once
}

func New(logger *slog.Logger, r io.Reader) (*Parser, error) {
	return &Parser{
		logger:  logger,
		scanner: merge.FromIOReader(lines.NewLiner(), r),
		liner:   lines.NewLiner(),
	}, nil
}

func NewFromScanner(logger *slog.Logger, liner *lines.Liner, scan merge.Scan) *Parser {
	return &Parser{
		logger:  logger,
		scanner: scan,
		liner:   liner,
		metrics: Metrics{
			PreProcessDuration: 0,
			TotalParseDuration: 0,
			TotalLinesParsed:   0,
			UnmatchedTime:      0,
			MatchingTime:       make(map[string]time.Duration),
			UnmatchingTime:     make(map[string]time.Duration),
		},
	}
}

func (p *Parser) Metrics() Metrics {
	return p.metrics
}

//func (p *Parser) State() *state.State {
//	return p.state
//}

// Merger returns a configured merger for this parser.
func Merger(logger *slog.Logger) *merge.Merger {
	return merge.NewMerger(logger) //merge.WithMiddleWare(OnlyKeepRawV2Casts),
}

func (p *Parser) init() error {
	var initErr error
	p.setup.Do(func() {
		scan, me, lc, err := whoami.FindMe(p.liner, p.scanner)
		if err != nil {
			initErr = fmt.Errorf("find me: %w", err)
			return
		}

		p.logger.Info("Identified 'me' in logs",
			slog.String("name", me.Name),
			slog.String("guid", me.Gid.String()),
			slog.Int("lines_read", lc),
		)
		p.scanner = scan
		p.you = &youReplacer{Me: me}
	})
	return initErr
}

func (p *Parser) Advance() ([]messages.Message, error) {
	err := p.init()
	if err != nil {
		return nil, AsFatalError(fmt.Errorf("init: %w", err))
	}
	now := time.Now()

	ts, original, err := p.scanner()
	if err != nil {
		return nil, err
	}

	if p.lastLogDate.IsZero() {
		p.lastLogDate = ts
	}

	if ts.Before(p.lastLogDate.Add(-time.Second)) {
		return nil, AsFatalError(fmt.Errorf("log dates went backwards: last %v, current %v", p.lastLogDate, ts))
	}

	preNow := time.Now()
	content, err := p.you.Preprocess(original)
	if err != nil {
		return nil, fmt.Errorf("preprocess line failed: %v", err)
	}
	content = strings.TrimSpace(content)
	p.metrics.PreProcessDuration += time.Since(preNow)

	if content == "" {
		// Maybe the preprocessing removed all content, it does not matter.
		// Empty lines are not interesting.
		return messages.Skip(ts, "empty line"), nil
	}

	msgs, err := p.ParseContent(ts, content)
	if err != nil {
		return nil, err
	}

	for _, msg := range msgs {
		if msg.Date().IsZero() {
			return nil, fmt.Errorf("timestamp is zero for message type: %s", reflect.TypeOf(msg).String())
		}
	}
	p.metrics.TotalParseDuration += time.Since(now)
	p.metrics.TotalLinesParsed++
	return msgs, err
}

func (p *Parser) ParseContent(ts time.Time, content string) ([]messages.Message, error) {
	start := time.Now()
	p.initMatchers.Do(func() {
		p.matchers = []parseLine{
			p.fCombatantInfo,                // ✓
			p.fUnitInfo,                     // ✓
			p.fZoneInfo,                     // ✓
			p.fV2Casts,                      // ✓
			p.fLoot,                         // ✓
			p.fCombatCount,                  // ✓
			p.fBugDamageSpellHitOrCrit,      // ✓
			p.fSpellCastAttempt,             // ✓
			p.fGain,                         // ✓
			p.fDamageSpellHitOrCritNoSchool, // ✓
			p.fDamageSpellHitOrCritSchool,   // ✓
			p.fDamagePeriodic,               // ✓
			p.fDamageShield,                 // ✓
			p.fDamageHitOrCritNoSchool,      // ✓
			p.fDamageHitOrCritSchool,        // ✓
			p.fHeal,                         // ✓
			p.fAuraGainHarmfulHelpful,       // ✓
			p.fAuraFade,                     // ✓
			p.fDamageSpellSplit,             // ✓
			p.fDamageSpellMiss,              // ✓
			p.fDamageSpellBlockParryEvadeDodgeResistDeflect, // ✓
			p.fDamageSpellAbsorb,                            // ✓
			p.fDamageSpellAbsorbSelf,                        // x TODO: need an example
			p.fDamageReflect,                                // ✓
			p.fDamageProcResist,                             // x TODO: need an example
			p.fDamageSpellImmune,                            // ✓
			p.fDamageMiss,                                   // ✓
			p.fDamageBlockParryEvadeDodgeDeflect,            // ✓
			p.fDamageAbsorbResist,                           // ✓
			p.fDamageImmune,                                 // ✓
			p.fSpellCastPerformDurability,                   // x TODO: need an example
			p.fSpellCastPerform,                             // ✓
			p.fSpellCastPerformUnknown,                      // ✓
			p.fHonorableKill,                                // ✓ (TODO: add currency gain for honor)
			p.fUnitDieDestroyed,                             // ✓
			p.fUnitDieDestroyedExperience,                   // ✓ (TODO: add experience gain)
			p.fUnitSlay,                                     // ✓
			p.fAuraDispel,                                   // ✓
			p.fAuraInterrupt,                                // ✓
			p.fCreates,                                      // ✓
			p.fGainsAttack,                                  // ✓
			p.fFallDamage,                                   // ✓
			p.fDurabilityLoss,                               // ✓
			p.fUsesConsumable,                               // ✓
			p.fResourceDrain,                                // ✓
			p.fReputationChange,                             // ✓
			p.fPetEats,                                      // ✓
			p.fKilledBy,                                     // ✓
			p.fLavaSwimming,                                 // ✓
			p.fFullResist,                                   // x TODO: Unsure what to do with this, there is no target
			p.fFullImmune,                                   // ✓
			p.fPetHappiness,                                 // ✓
			p.fPetDismissed,                                 // ✓
		}
		p.matcherNames = make([]string, 0, len(p.matchers))

		for _, f := range p.matchers {
			p.matcherNames = append(p.matcherNames, runtime.FuncForPC(reflect.ValueOf(f).Pointer()).Name())
		}
	})

	for i, parser := range p.matchers {
		matcherName := p.matcherNames[i]
		startMatch := time.Now()
		m, err := parser(ts, content)
		if err != nil {
			return nil, err
		}

		if len(m) == 0 {
			p.metrics.UnmatchingTime[matcherName] += time.Since(startMatch)
			continue
		}

		p.metrics.MatchingTime[matcherName] += time.Since(startMatch)
		p.metrics.UnmatchedTime += startMatch.Sub(start)
		return m, nil
	}

	return set(messages.UnparsedLine{
		MessageBase: messages.Base(ts),
		Content:     content,
	}), nil
}

func set(m ...messages.Message) []messages.Message {
	return m
}
