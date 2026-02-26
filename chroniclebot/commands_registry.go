package chroniclebot

func DefaultCommands(bot *Bot) []Command {
	return []Command{
		randomWithoutRoleCommand(bot),
	}
}
