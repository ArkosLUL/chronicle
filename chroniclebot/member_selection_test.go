package chroniclebot

import (
	"math/rand"
	"slices"
	"testing"

	"github.com/bwmarrin/discordgo"
)

func TestFilterMembersWithoutRole(t *testing.T) {
	t.Parallel()

	members := []*discordgo.Member{
		{User: &discordgo.User{ID: "1"}, Roles: []string{"role-a"}},
		{User: &discordgo.User{ID: "2"}, Roles: []string{"role-b"}},
		{User: &discordgo.User{ID: "3", Bot: true}, Roles: []string{}},
		{User: nil, Roles: []string{}},
		nil,
		{User: &discordgo.User{ID: "4"}, Roles: []string{}},
	}

	got := filterMembersWithoutRole(members, "role-a")
	gotIDs := memberIDs(got)
	wantIDs := []string{"2", "4"}
	if !slices.Equal(gotIDs, wantIDs) {
		t.Fatalf("unexpected filtered members: got %v want %v", gotIDs, wantIDs)
	}
}

func TestPickRandomMembersDeterministicWithSeed(t *testing.T) {
	t.Parallel()

	input := []string{"u1", "u2", "u3", "u4", "u5"}

	rndA := rand.New(rand.NewSource(7))
	rndB := rand.New(rand.NewSource(7))

	gotA := pickRandomMembers(input, 3, rndA)
	gotB := pickRandomMembers(input, 3, rndB)

	if !slices.Equal(gotA, gotB) {
		t.Fatalf("expected deterministic selection, got %v and %v", gotA, gotB)
	}

	if len(gotA) != 3 {
		t.Fatalf("expected 3 picks, got %d", len(gotA))
	}

	if slices.Equal(input, gotA) {
		t.Fatalf("expected shuffled output to differ from original order")
	}
}

func TestPickRandomMembersCountExceedsEligible(t *testing.T) {
	t.Parallel()

	input := []int{1, 2, 3}
	got := pickRandomMembers(input, 10, rand.New(rand.NewSource(1)))

	if len(got) != len(input) {
		t.Fatalf("expected %d members, got %d", len(input), len(got))
	}

	for _, in := range input {
		if !slices.Contains(got, in) {
			t.Fatalf("expected output to contain %d", in)
		}
	}
}

func TestPickRandomMembersZeroCountOrEmptyInput(t *testing.T) {
	t.Parallel()

	if got := pickRandomMembers([]int{1, 2, 3}, 0, rand.New(rand.NewSource(1))); got != nil {
		t.Fatalf("expected nil when count is zero, got %v", got)
	}

	if got := pickRandomMembers([]int{}, 1, rand.New(rand.NewSource(1))); got != nil {
		t.Fatalf("expected nil when input is empty, got %v", got)
	}
}

func memberIDs(members []*discordgo.Member) []string {
	ids := make([]string, 0, len(members))
	for _, member := range members {
		ids = append(ids, member.User.ID)
	}
	return ids
}
