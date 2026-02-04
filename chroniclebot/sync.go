package chroniclebot

import (
	"context"
	"errors"
	"time"

	"github.com/Emyrk/chronicle/database"
	"github.com/Emyrk/chronicle/internal/slice"
	"github.com/google/uuid"
)

func (bot *Bot) SyncDiscordUser(ctx context.Context, tx database.Store, discordID string, userID uuid.UUID) (retErr error) {
	member, err := bot.GetGuildMember(bot.ChronicleGuildID(), discordID)
	if err != nil {
		return err
	}

	roles := make([]database.UserRoles, 0)
	defer func() {
		_, retErr = tx.UpdateUserRoles(ctx, database.UpdateUserRolesParams{
			ID:        userID,
			Roles:     roles,
			UpdatedAt: database.Timestamptz(time.Now()),
		})
	}()

	if member == nil {
		// DELETE ALL PERMS
		return errors.New("must be in the discord server to use chronicle")
	}

	for _, roleID := range member.Roles {
		switch roleID {
		case "1468405974506410110": // Alpha tester
			roles = append(roles, database.UserRolesAlphaTester)
		case "1467892674743898297": // Owner
			roles = append(roles, database.UserRolesTechnicalAdmin, database.UserRolesAlphaTester)
		case "1467890007854551120":
			roles = append(roles, database.UserRolesAdmin, database.UserRolesAlphaTester)
		}
	}

	roles = slice.Unique(roles)

	return nil
}
