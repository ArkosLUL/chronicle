package blackrockspire

import "github.com/Emyrk/chronicle/combatlog/parser/vanilla/state/encounters"

func BlackrockSpireHostiles() map[uint32]encounters.Identity {
	hostile := make(map[uint32]encounters.Identity)
	for k, _ := range map[uint32]string{
		9816:  "Pyroguard Emberseer",
		10161: "Rookery Whelp",
		10742: "Blackhand Dragon Handler",
		9096:  "Rage Talon Dragonspawn",
		9817:  "Blackhand Dreadweaver",
		10442: "Chromatic Whelp",
		10318: "Blackhand Assassin",
		10430: "The Beast",
		10814: "Chromatic Elite Guard",
		9818:  "Blackhand Summoner",
		10680: "Summoned Blackhand Dreadweaver",
		10681: "Summoned Blackhand Veteran",
		10447: "Chromatic Dragonspawn",
		10429: "Warchief Rend Blackhand",
		10339: "Gyth", // Blackhand mount
		10366: "Rage Talon Dragon Guard",
		10371: "Rage Talon Captain",
		10363: "General Drakkisath",
		9097:  "Scarshield Legionnaire",
		10316: "Blackhand Incarcerator",
		10083: "Rage Talon Flamescale",
		10317: "Blackhand Elite",
		10372: "Rage Talon Fire Tongue",
		10319: "Blackhand Iron Guard",
		9819:  "Blackhand Veteran",
	} {
		hostile[k] = encounters.Identity{Hostile: true}
	}
	return hostile
}
