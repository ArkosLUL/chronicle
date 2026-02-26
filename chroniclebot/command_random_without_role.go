package chroniclebot

import (
	"fmt"
	"math/rand"
	"strings"
	"time"

	"github.com/bwmarrin/discordgo"
)

const maxRandomPickCount = 50

func randomWithoutRoleCommand(_ *Bot) Command {
	manageGuildPermission := int64(discordgo.PermissionManageGuild)
	dmPermission := false
	minCount := 1.0

	return Command{
		Definition: &discordgo.ApplicationCommand{
			Name:                     "pick-without-role",
			Description:              "Pick random members who do not have a role",
			DefaultMemberPermissions: &manageGuildPermission,
			DMPermission:             &dmPermission,
			Options: []*discordgo.ApplicationCommandOption{
				{
					Type:        discordgo.ApplicationCommandOptionInteger,
					Name:        "count",
					Description: fmt.Sprintf("How many members to pick (max %d)", maxRandomPickCount),
					Required:    true,
					MinValue:    &minCount,
				},
				{
					Type:        discordgo.ApplicationCommandOptionRole,
					Name:        "exclude_role",
					Description: "Only pick members that do not have this role",
					Required:    true,
				},
				{
					Type:        discordgo.ApplicationCommandOptionChannel,
					Name:        "target_channel",
					Description: "Channel to post results in (defaults to current channel)",
					Required:    false,
				},
			},
		},
		Handler: handleRandomWithoutRoleCommand,
	}
}

func handleRandomWithoutRoleCommand(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if i.GuildID == "" {
		_ = RespondEphemeral(s, i, "This command only works in a server channel.")
		return
	}

	count, excludedRoleID, targetChannelID, err := parseRandomWithoutRoleOptions(s, i)
	if err != nil {
		_ = RespondEphemeral(s, i, err.Error())
		return
	}

	wasCapped := false
	if count > maxRandomPickCount {
		count = maxRandomPickCount
		wasCapped = true
	}

	members, err := fetchAllGuildMembers(s, i.GuildID)
	if err != nil {
		_ = RespondEphemeral(s, i, fmt.Sprintf("Failed to fetch guild members: %v", err))
		return
	}

	eligible := filterMembersWithoutRole(members, excludedRoleID)
	if len(eligible) == 0 {
		_ = RespondEphemeral(s, i, fmt.Sprintf("No eligible members found without <@&%s>.", excludedRoleID))
		return
	}

	rnd := rand.New(rand.NewSource(time.Now().UnixNano()))
	selected := pickRandomMembers(eligible, count, rnd)
	if len(selected) == 0 {
		_ = RespondEphemeral(s, i, "No members were selected.")
		return
	}

	msg := formatRandomWithoutRoleMessage(selected, excludedRoleID)
	if _, err := s.ChannelMessageSend(targetChannelID, msg); err != nil {
		_ = RespondEphemeral(s, i, fmt.Sprintf("Failed to send message in <#%s>: %v", targetChannelID, err))
		return
	}

	response := fmt.Sprintf("Posted %d random member(s) without <@&%s> in <#%s>.", len(selected), excludedRoleID, targetChannelID)
	if wasCapped {
		response = fmt.Sprintf("Count was capped at %d. %s", maxRandomPickCount, response)
	}
	if count > len(eligible) {
		response = fmt.Sprintf("Only %d eligible members were available. %s", len(eligible), response)
	}
	_ = RespondEphemeral(s, i, response)
}

func parseRandomWithoutRoleOptions(s *discordgo.Session, i *discordgo.InteractionCreate) (count int, excludedRoleID, targetChannelID string, err error) {
	data := i.ApplicationCommandData()
	countOpt := findOption(data.Options, "count")
	excludeRoleOpt := findOption(data.Options, "exclude_role")
	if countOpt == nil || excludeRoleOpt == nil {
		return 0, "", "", fmt.Errorf("missing required command options")
	}

	count = int(countOpt.IntValue())
	if count <= 0 {
		return 0, "", "", fmt.Errorf("count must be greater than zero")
	}

	excludedRoleID = optionRoleID(s, i.GuildID, excludeRoleOpt)
	if excludedRoleID == "" {
		return 0, "", "", fmt.Errorf("could not resolve the role to exclude")
	}

	targetChannelID = i.ChannelID
	if channelOpt := findOption(data.Options, "target_channel"); channelOpt != nil {
		chID := optionChannelID(s, channelOpt)
		if chID == "" {
			return 0, "", "", fmt.Errorf("could not resolve target channel")
		}
		targetChannelID = chID
	}

	return count, excludedRoleID, targetChannelID, nil
}

func formatRandomWithoutRoleMessage(selected []*discordgo.Member, excludedRoleID string) string {
	var sb strings.Builder
	sb.WriteString("🎲 Random picks")
	sb.WriteString("\n")
	sb.WriteString(fmt.Sprintf("Members without <@&%s>:\n", excludedRoleID))
	for idx, member := range selected {
		sb.WriteString(fmt.Sprintf("%d. <@%s>\n", idx+1, member.User.ID))
	}
	return strings.TrimSpace(sb.String())
}

func fetchAllGuildMembers(s *discordgo.Session, guildID string) ([]*discordgo.Member, error) {
	const pageSize = 1000

	members := make([]*discordgo.Member, 0, pageSize)
	after := ""
	for {
		batch, err := s.GuildMembers(guildID, after, pageSize)
		if err != nil {
			return nil, err
		}
		if len(batch) == 0 {
			break
		}

		members = append(members, batch...)
		if len(batch) < pageSize {
			break
		}

		nextAfter := ""
		for idx := len(batch) - 1; idx >= 0; idx-- {
			if batch[idx] != nil && batch[idx].User != nil && batch[idx].User.ID != "" {
				nextAfter = batch[idx].User.ID
				break
			}
		}
		if nextAfter == "" || nextAfter == after {
			break
		}
		after = nextAfter
	}

	return members, nil
}

func findOption(options []*discordgo.ApplicationCommandInteractionDataOption, name string) *discordgo.ApplicationCommandInteractionDataOption {
	for _, option := range options {
		if option != nil && option.Name == name {
			return option
		}
	}
	return nil
}

func optionRoleID(s *discordgo.Session, guildID string, option *discordgo.ApplicationCommandInteractionDataOption) string {
	if option == nil {
		return ""
	}
	if role := option.RoleValue(s, guildID); role != nil {
		return role.ID
	}
	if val, ok := option.Value.(string); ok {
		return val
	}
	return option.StringValue()
}

func optionChannelID(s *discordgo.Session, option *discordgo.ApplicationCommandInteractionDataOption) string {
	if option == nil {
		return ""
	}
	if channel := option.ChannelValue(s); channel != nil {
		return channel.ID
	}
	if val, ok := option.Value.(string); ok {
		return val
	}
	return option.StringValue()
}
