package chroniclebot

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"github.com/Emyrk/chronicle/database/authz"
	"github.com/Emyrk/chronicle/database/authz/policy"
	"github.com/Emyrk/chronicle/internal/storagegrants"
	"github.com/authzed/gochugaru/rel"
	"github.com/google/uuid"
	"github.com/riverqueue/river"
)

var ErrMustJoinDiscordServer = errors.New("must be in the discord server to use chronicle")

func (bot *Bot) SyncDiscordUser(ctx context.Context, zed authz.DatabaseAuthorizer, discordID string, userID uuid.UUID) (retErr error) {
	b := policy.New()
	gChron := b.GlobalChronicle()
	usr := b.User(userID)

	// Create a filter to remove all their existing roles from the global namespace
	f := rel.NewFilter(gChron.Object().Typ, gChron.Object().ID, "")
	f.WithSubjectFilter(usr.Object().Typ, usr.Object().ID, "")
	err := zed.Delete(ctx, rel.NewPreconditionedFilter(f))
	if err != nil {
		return fmt.Errorf("zed.Delete: %w", err)
	}

	// Add back roles based on their current discord roles
	member, err := bot.GetGuildMember(bot.ChronicleGuildID(), discordID)
	if err != nil {
		return err
	}

	gChron.Chronicle_member(usr)
	if member != nil {
		// User is in the discord
		gChron.Chronicle_guild_member(usr)
		for _, roleID := range member.Roles {
			switch roleID {
			case "1468405974506410110": // Alpha tester
				gChron.Upload_capable(usr)
			case "1467892674743898297": // Owner
				gChron.Technical_admin(usr)
			case "1467890007854551120": // Admin
				gChron.Admin(usr)
			case "1475993966041239623": // Technical User
				gChron.Technical_user(usr)
			case "1476428881677389865", // Booster
				"1476558127552790812": // Supporter
				gChron.Supporter(usr)
				_, err := zed.UpsertDataGrant(ctx, storagegrants.SupportStorageGrant(userID))
				if err != nil {
					bot.logger.Error("upsert supporter storage grant", slog.String("error", err.Error()))
				}
			}
		}
	}

	_, err = zed.Write(ctx, *b.Txn())
	if err != nil {
		return fmt.Errorf("zed.Write: %w", err)
	}

	_ = river.RecordOutput(ctx, map[string]any{
		"username": member.User.Username,
	})
	return nil
}
