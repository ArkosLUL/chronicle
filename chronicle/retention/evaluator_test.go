package retention_test

import (
	"testing"
	"time"

	"github.com/Emyrk/chronicle/chronicle/retention"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

var now = time.Date(2025, 6, 1, 0, 0, 0, 0, time.UTC)

func ptr[T any](v T) *T { return &v }

func TestEvaluate_NoRules(t *testing.T) {
	t.Parallel()
	c := retention.InstanceCandidate{
		ID:           uuid.New(),
		InstanceName: "Onyxia's Lair",
		EndTime:      now.AddDate(0, 0, -10),
	}
	result := retention.Evaluate(nil, c, now)
	assert.Empty(t, result.Action)
	assert.Nil(t, result.MatchedRule)
}

func TestEvaluate_AgeDelete(t *testing.T) {
	t.Parallel()
	rules := []retention.Rule{
		{Priority: 1, Action: retention.ActionDelete, Description: "delete old", Conditions: []retention.Condition{
			{Type: retention.ConditionTypeAge, Days: 30},
		}},
	}

	t.Run("old enough", func(t *testing.T) {
		t.Parallel()
		c := retention.InstanceCandidate{
			ID:           uuid.New(),
			InstanceName: "Molten Core",
			EndTime:      now.AddDate(0, 0, -60),
		}
		result := retention.Evaluate(rules, c, now)
		assert.Equal(t, retention.ActionDelete, result.Action)
	})

	t.Run("too recent", func(t *testing.T) {
		t.Parallel()
		c := retention.InstanceCandidate{
			ID:           uuid.New(),
			InstanceName: "Molten Core",
			EndTime:      now.AddDate(0, 0, -10),
		}
		result := retention.Evaluate(rules, c, now)
		assert.Empty(t, result.Action, "should not match")
	})
}

func TestEvaluate_InstanceNameAndAge(t *testing.T) {
	t.Parallel()
	// Delete Onyxia logs older than 30 days
	rules := []retention.Rule{
		{Priority: 1, Action: retention.ActionDelete, Description: "purge old onyxia", Conditions: []retention.Condition{
			{Type: retention.ConditionTypeInstanceName, Names: []string{"Onyxia's Lair"}},
			{Type: retention.ConditionTypeAge, Days: 30, Combinator: "and"},
		}},
	}

	t.Run("onyxia and old", func(t *testing.T) {
		t.Parallel()
		c := retention.InstanceCandidate{
			ID: uuid.New(), InstanceName: "Onyxia's Lair",
			EndTime: now.AddDate(0, 0, -60),
		}
		assert.Equal(t, retention.ActionDelete, retention.Evaluate(rules, c, now).Action)
	})

	t.Run("onyxia but recent", func(t *testing.T) {
		t.Parallel()
		c := retention.InstanceCandidate{
			ID: uuid.New(), InstanceName: "Onyxia's Lair",
			EndTime: now.AddDate(0, 0, -5),
		}
		assert.Empty(t, retention.Evaluate(rules, c, now).Action)
	})

	t.Run("molten core and old - no match", func(t *testing.T) {
		t.Parallel()
		c := retention.InstanceCandidate{
			ID: uuid.New(), InstanceName: "Molten Core",
			EndTime: now.AddDate(0, 0, -60),
		}
		assert.Empty(t, retention.Evaluate(rules, c, now).Action)
	})
}

func TestEvaluate_TopSpeedrunKeep(t *testing.T) {
	t.Parallel()
	rules := []retention.Rule{
		{Priority: 1, Action: retention.ActionKeep, Description: "keep top 3", Conditions: []retention.Condition{
			{Type: retention.ConditionTypeTopGuildSpeedrun, TopN: 3},
		}},
		{Priority: 2, Action: retention.ActionDelete, Description: "delete all old", Conditions: []retention.Condition{
			{Type: retention.ConditionTypeAge, Days: 90},
		}},
	}

	t.Run("top ranked keeps", func(t *testing.T) {
		t.Parallel()
		c := retention.InstanceCandidate{
			ID: uuid.New(), InstanceName: "Molten Core",
			EndTime:   now.AddDate(0, 0, -120),
			GuildRank: ptr(int64(2)),
		}
		result := retention.Evaluate(rules, c, now)
		assert.Equal(t, retention.ActionKeep, result.Action)
	})

	t.Run("not ranked deletes", func(t *testing.T) {
		t.Parallel()
		c := retention.InstanceCandidate{
			ID: uuid.New(), InstanceName: "Molten Core",
			EndTime:   now.AddDate(0, 0, -120),
			GuildRank: nil,
		}
		result := retention.Evaluate(rules, c, now)
		assert.Equal(t, retention.ActionDelete, result.Action)
	})

	t.Run("rank 5 deletes", func(t *testing.T) {
		t.Parallel()
		c := retention.InstanceCandidate{
			ID: uuid.New(), InstanceName: "Molten Core",
			EndTime:   now.AddDate(0, 0, -120),
			GuildRank: ptr(int64(5)),
		}
		result := retention.Evaluate(rules, c, now)
		assert.Equal(t, retention.ActionDelete, result.Action)
	})
}

func TestEvaluate_NegatedCondition(t *testing.T) {
	t.Parallel()
	// Delete anything NOT named Molten Core that's older than 30 days
	rules := []retention.Rule{
		{Priority: 1, Action: retention.ActionDelete, Description: "delete non-MC", Conditions: []retention.Condition{
			{Type: retention.ConditionTypeInstanceName, Names: []string{"Molten Core"}, Negate: true},
			{Type: retention.ConditionTypeAge, Days: 30, Combinator: "and"},
		}},
	}

	t.Run("onyxia old deletes", func(t *testing.T) {
		t.Parallel()
		c := retention.InstanceCandidate{
			ID: uuid.New(), InstanceName: "Onyxia's Lair",
			EndTime: now.AddDate(0, 0, -60),
		}
		assert.Equal(t, retention.ActionDelete, retention.Evaluate(rules, c, now).Action)
	})

	t.Run("molten core old keeps", func(t *testing.T) {
		t.Parallel()
		c := retention.InstanceCandidate{
			ID: uuid.New(), InstanceName: "Molten Core",
			EndTime: now.AddDate(0, 0, -60),
		}
		assert.Empty(t, retention.Evaluate(rules, c, now).Action)
	})
}

func TestEvaluate_OrCombinator(t *testing.T) {
	t.Parallel()
	// Delete Onyxia OR BWL logs older than 30 days
	rules := []retention.Rule{
		{Priority: 1, Action: retention.ActionDelete, Description: "ony or bwl old", Conditions: []retention.Condition{
			{Type: retention.ConditionTypeInstanceName, Names: []string{"Onyxia's Lair"}},
			{Type: retention.ConditionTypeInstanceName, Names: []string{"Blackwing Lair"}, Combinator: "or"},
			{Type: retention.ConditionTypeAge, Days: 30, Combinator: "and"},
		}},
	}

	c := retention.InstanceCandidate{
		ID: uuid.New(), InstanceName: "Blackwing Lair",
		EndTime: now.AddDate(0, 0, -60),
	}
	assert.Equal(t, retention.ActionDelete, retention.Evaluate(rules, c, now).Action)

	c2 := retention.InstanceCandidate{
		ID: uuid.New(), InstanceName: "Molten Core",
		EndTime: now.AddDate(0, 0, -60),
	}
	assert.Empty(t, retention.Evaluate(rules, c2, now).Action)
}

func TestEvaluate_EmptyConditionsAlwaysMatch(t *testing.T) {
	t.Parallel()
	rules := []retention.Rule{
		{Priority: 1, Action: retention.ActionDelete, Description: "catch all"},
	}
	c := retention.InstanceCandidate{
		ID: uuid.New(), InstanceName: "Anything",
		EndTime: now,
	}
	assert.Equal(t, retention.ActionDelete, retention.Evaluate(rules, c, now).Action)
}

func TestEvaluate_FirstMatchWins(t *testing.T) {
	t.Parallel()
	rules := []retention.Rule{
		{Priority: 1, Action: retention.ActionKeep, Description: "keep top runs", Conditions: []retention.Condition{
			{Type: retention.ConditionTypeTopGuildSpeedrun, TopN: 3},
		}},
		{Priority: 2, Action: retention.ActionDelete, Description: "delete onyxia old", Conditions: []retention.Condition{
			{Type: retention.ConditionTypeInstanceName, Names: []string{"Onyxia's Lair"}},
			{Type: retention.ConditionTypeAge, Days: 30, Combinator: "and"},
		}},
		{Priority: 3, Action: retention.ActionDelete, Description: "delete all old", Conditions: []retention.Condition{
			{Type: retention.ConditionTypeAge, Days: 90},
		}},
	}

	// Top-ranked Onyxia kept by rule 1, even though rule 2 would delete
	c := retention.InstanceCandidate{
		ID: uuid.New(), InstanceName: "Onyxia's Lair",
		EndTime:   now.AddDate(0, 0, -60),
		GuildRank: ptr(int64(1)),
	}
	result := retention.Evaluate(rules, c, now)
	assert.Equal(t, retention.ActionKeep, result.Action)
	assert.NotNil(t, result.MatchedRule)
	assert.Equal(t, "keep top runs", *result.MatchedRule)
}

func TestParseConditions(t *testing.T) {
	t.Parallel()

	t.Run("empty", func(t *testing.T) {
		t.Parallel()
		conds, err := retention.ParseConditions([]byte("[]"))
		assert.NoError(t, err)
		assert.Nil(t, conds)
	})

	t.Run("round trip", func(t *testing.T) {
		t.Parallel()
		original := []retention.Condition{
			{Type: "age", Days: 30},
			{Type: "instance_name", Names: []string{"Onyxia's Lair"}, Combinator: "and"},
		}
		data := retention.MustMarshalConditions(original)
		parsed, err := retention.ParseConditions(data)
		assert.NoError(t, err)
		assert.Equal(t, original, parsed)
	})
}
