// Shared instance configuration - maps instance names to loading screen images
// Source of truth - also used in RaidCard.tsx

export interface InstanceConfig {
  background: string;
  bossCount?: number;
}

export const INSTANCE_CONFIG: Record<string, InstanceConfig> = {
  // 40-man Raids
  "Molten Core": { background: "/images/loadingscreens/LoadScreenMoltenCore.webp", bossCount: 12 },
  "Blackwing Lair": { background: "/images/loadingscreens/LoadScreenBlackWingLair.webp", bossCount: 8 },
  "Temple of Ahn'Qiraj": { background: "/images/loadingscreens/LoadScreenAhnQiraj40man.webp", bossCount: 9 },
  "Naxxramas": { background: "/images/loadingscreens/LoadScreenNaxxramas.webp", bossCount: 15 },
  "Emerald Sanctum": { background: "/images/loadingscreens/LoadScreenEmeraldSanctum.webp", bossCount: 2 },
  // 20-man Raids
  "Zul'Gurub": { background: "/images/loadingscreens/LoadScreenZulGurub.webp", bossCount: 10 },
  "Ruins of Ahn'Qiraj": { background: "/images/loadingscreens/LoadScreenAhnQiraj20man.webp", bossCount: 6 },
  // Single Boss
  "Onyxia's Lair": { background: "/images/loadingscreens/LoadScreenRaid.webp", bossCount: 1 },
  // Turtle WoW Custom
  "Tower of Karazhan": { background: "/images/loadingscreens/LoadScreenKarazhan.webp", bossCount: 5 },
  "Karazhan Crypts": { background: "/images/loadingscreens/LoadscreenKarazhanCrypt.webp", bossCount: 3 },
  "Hateforge Quarry": { background: "/images/loadingscreens/LoadScreenHateforge.webp", bossCount: 4 },
  "Gilneas City": { background: "/images/loadingscreens/LoadScreenGilneasCity.webp", bossCount: 3 },
  "World Bosses": { background: "/images/loadingscreens/LoadScreenRaid.webp" },
  // Dungeons
  "Upper Blackrock Spire": { background: "/images/loadingscreens/LoadScreenBlackrockSpire.webp", bossCount: 5 },
  "Lower Blackrock Spire": { background: "/images/loadingscreens/LoadScreenBlackrockSpire.webp" },
  "Deadmines": { background: "/images/loadingscreens/LoadScreenDeadmines.webp", bossCount: 8 },
  "Shadowfang Keep": { background: "/images/loadingscreens/LoadScreenShadowFangKeep.webp" },
  "Scarlet Monastery": { background: "/images/loadingscreens/LoadScreenMonastery.webp" },
  "Scarlet Monastery Library": { background: "/images/loadingscreens/LoadScreenMonastery.webp", bossCount: 3 },
  "Scarlet Monastery Cathedral": { background: "/images/loadingscreens/LoadScreenMonastery.webp", bossCount: 2 },
  "Scarlet Monastery Graveyard": { background: "/images/loadingscreens/LoadScreenMonastery.webp" },
  "Scarlet Monastery Armory": { background: "/images/loadingscreens/LoadScreenMonastery.webp" },
  "Stratholme": { background: "/images/loadingscreens/LoadScreenStrathome.webp" },
  "Scholomance": { background: "/images/loadingscreens/LoadScreenScholomance.webp" },
  "Blackrock Depths": { background: "/images/loadingscreens/LoadScreenBlackrockDepths.webp" },
  "Dire Maul": { background: "/images/loadingscreens/LoadScreenDireMaul.webp" },
  "Maraudon": { background: "/images/loadingscreens/LoadScreenMaraudon.webp" },
  "Sunken Temple": { background: "/images/loadingscreens/LoadScreenSunkenTemple.webp" },
  "Zul'Farrak": { background: "/images/loadingscreens/LoadScreenZulFarrak.webp" },
  "Uldaman": { background: "/images/loadingscreens/LoadScreenUldaman.webp" },
  "Razorfen Downs": { background: "/images/loadingscreens/LoadScreenRazorfenDowns.webp" },
  "Razorfen Kraul": { background: "/images/loadingscreens/LoadScreenRazorfenKraul.webp" },
  "Wailing Caverns": { background: "/images/loadingscreens/LoadScreenWailingCaverns.webp" },
  "Blackfathom Deeps": { background: "/images/loadingscreens/LoadScreenBlackFathomDeeps.webp" },
  "Gnomeregan": { background: "/images/loadingscreens/LoadScreenGnomeregan.webp" },
  "Ragefire Chasm": { background: "/images/loadingscreens/LoadScreenRagefireChasm.webp", bossCount: 4 },
  "Stormwind Stockade": { background: "/images/loadingscreens/LoadScreenStormwindStockade.webp" },
  "Caverns of Time": { background: "/images/loadingscreens/LoadScreenCavernsTime.webp" },
};

export const DEFAULT_BACKGROUND = "/images/loadingscreens/LoadScreenDungeon.webp";

export function getInstanceConfig(name: string): InstanceConfig | undefined {
  return INSTANCE_CONFIG[name];
}

export function getInstanceBackground(name: string): string {
  return INSTANCE_CONFIG[name]?.background ?? DEFAULT_BACKGROUND;
}
