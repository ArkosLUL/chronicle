// Package retention implements the log retention rule evaluator.
// Rules follow a first-match-wins model (like firewall rules).
// Each rule has conditions (AND/OR combinable, negatable) and an action (keep/delete).
package retention

import (
	"encoding/json"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"
)

const (
	ActionKeep   = "keep"
	ActionDelete = "delete"
)

const (
	ConditionTypeAge              = "age"
	ConditionTypeInstanceName     = "instance_name"
	ConditionTypeTopGuildSpeedrun = "top_guild_speedrun"
)

// Condition is a single predicate within a rule.
type Condition struct {
	Type       string   `json:"type"`
	Combinator string   `json:"combinator,omitempty"` // "and" | "or"; first condition's combinator is ignored
	Negate     bool     `json:"negate,omitempty"`
	Days       int      `json:"days,omitempty"`
	Names      []string `json:"names,omitempty"`
	TopN       int      `json:"top_n,omitempty"`
}

// Rule is an ordered retention rule with conditions and an action.
type Rule struct {
	Priority    int
	Action      string // "keep" | "delete"
	Conditions  []Condition
	Description string
}

// InstanceCandidate is a log instance enriched with metadata for rule evaluation.
type InstanceCandidate struct {
	ID           uuid.UUID
	InstanceName string
	EndTime      time.Time
	GuildRank    *int64 // nil if no speedrun or no guild
	LogGroupID   uuid.UUID
}

// EvaluateResult is the outcome of evaluating a single candidate.
type EvaluateResult struct {
	Action      string // "keep", "delete", or "" if no rule matched
	MatchedRule *string
}

// Evaluate tests the candidate against rules in priority order.
// First matching rule wins. Returns empty action if no rule matches.
func Evaluate(rules []Rule, candidate InstanceCandidate, now time.Time) EvaluateResult {
	for _, rule := range rules {
		if matchRule(rule, candidate, now) {
			desc := rule.Description
			return EvaluateResult{
				Action:      rule.Action,
				MatchedRule: &desc,
			}
		}
	}
	return EvaluateResult{}
}

// matchRule returns true if all condition groups in the rule match.
// Conditions are grouped using the same AND/OR combinator logic as panel filters:
// - "or" continues the current group (any in group must match)
// - "and" (or empty) starts a new group (all groups must match)
func matchRule(rule Rule, c InstanceCandidate, now time.Time) bool {
	if len(rule.Conditions) == 0 {
		return true // No conditions = always matches
	}

	// Group conditions: split on "and" boundaries
	type group struct {
		conditions []Condition
	}
	var groups []group
	var current group

	for i, cond := range rule.Conditions {
		if i == 0 || cond.Combinator != "or" {
			// Start new group
			if i > 0 {
				groups = append(groups, current)
			}
			current = group{}
		}
		current.conditions = append(current.conditions, cond)
	}
	groups = append(groups, current)

	// All groups must pass (AND between groups).
	// Within a group, any condition passing = group passes (OR within group).
	for _, g := range groups {
		groupPassed := false
		for _, cond := range g.conditions {
			result := evalCondition(cond, c, now)
			if cond.Negate {
				result = !result
			}
			if result {
				groupPassed = true
				break
			}
		}
		if !groupPassed {
			return false
		}
	}
	return true
}

func evalCondition(cond Condition, c InstanceCandidate, now time.Time) bool {
	switch cond.Type {
	case ConditionTypeAge:
		cutoff := now.AddDate(0, 0, -cond.Days)
		return c.EndTime.Before(cutoff)

	case ConditionTypeInstanceName:
		for _, name := range cond.Names {
			if strings.EqualFold(c.InstanceName, name) {
				return true
			}
		}
		return false

	case ConditionTypeTopGuildSpeedrun:
		if c.GuildRank == nil {
			return false
		}
		return *c.GuildRank <= int64(cond.TopN)

	default:
		return false
	}
}

// ParseConditions deserializes conditions from JSONB.
func ParseConditions(data json.RawMessage) ([]Condition, error) {
	var conditions []Condition
	if len(data) == 0 || string(data) == "[]" {
		return nil, nil
	}
	if err := json.Unmarshal(data, &conditions); err != nil {
		return nil, err
	}
	return conditions, nil
}

// MustMarshalConditions serializes conditions to JSON.
func MustMarshalConditions(conditions []Condition) json.RawMessage {
	data, err := json.Marshal(conditions)
	if err != nil {
		panic(err)
	}
	return data
}

// SortRules sorts rules by priority ascending.
func SortRules(rules []Rule) {
	slices.SortFunc(rules, func(a, b Rule) int {
		return a.Priority - b.Priority
	})
}
