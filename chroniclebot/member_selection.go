package chroniclebot

import (
	"math/rand"
	"time"

	"github.com/bwmarrin/discordgo"
)

func filterMembersWithoutRole(members []*discordgo.Member, excludedRoleID string) []*discordgo.Member {
	eligible := make([]*discordgo.Member, 0, len(members))
	for _, member := range members {
		if member == nil || member.User == nil || member.User.Bot {
			continue
		}
		if memberHasRole(member, excludedRoleID) {
			continue
		}
		eligible = append(eligible, member)
	}
	return eligible
}

func memberHasRole(member *discordgo.Member, roleID string) bool {
	for _, r := range member.Roles {
		if r == roleID {
			return true
		}
	}
	return false
}

func pickRandomMembers[T any](in []T, count int, rnd *rand.Rand) []T {
	if count <= 0 || len(in) == 0 {
		return nil
	}

	if rnd == nil {
		rnd = rand.New(rand.NewSource(time.Now().UnixNano()))
	}

	out := append([]T(nil), in...)
	rnd.Shuffle(len(out), func(i, j int) {
		out[i], out[j] = out[j], out[i]
	})

	if count > len(out) {
		count = len(out)
	}

	return out[:count]
}
