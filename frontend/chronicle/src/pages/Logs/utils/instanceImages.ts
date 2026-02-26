// Shared instance configuration - maps instance names to loading screen images
// Source of truth - also used in RaidCard.tsx

export interface InstanceConfig {
  background: string;
  bossCount?: number;
  abbrev?: string;  // Short name for mobile display
}

export const INSTANCE_CONFIG: Record<string, InstanceConfig> = {
  // 40-man Raids
  "Molten Core": { background: "/images/loadingscreens/LoadScreenMoltenCore.webp", bossCount: 12, abbrev: "MC" },
  "Blackwing Lair": { background: "/images/loadingscreens/LoadScreenBlackWingLair.webp", bossCount: 8, abbrev: "BWL" },
  "Temple of Ahn'Qiraj": { background: "/images/loadingscreens/LoadScreenAhnQiraj40man.webp", bossCount: 9, abbrev: "AQ40" },
  "Naxxramas": { background: "/images/loadingscreens/LoadScreenNaxxramas.webp", bossCount: 15, abbrev: "Naxx" },
  "Emerald Sanctum": { background: "/images/loadingscreens/LoadScreenEmeraldSanctum.webp", bossCount: 2, abbrev: "ES" },
  // 20-man Raids
  "Zul'Gurub": { background: "/images/loadingscreens/LoadScreenZulGurub.webp", bossCount: 10, abbrev: "ZG" },
  "Ruins of Ahn'Qiraj": { background: "/images/loadingscreens/LoadScreenAhnQiraj20man.webp", bossCount: 6, abbrev: "AQ20" },
  // Single Boss
  "Onyxia's Lair": { background: "/images/loadingscreens/LoadScreenRaid.webp", bossCount: 1, abbrev: "Ony" },
  // Turtle WoW Custom
  "Tower of Karazhan": { background: "/images/loadingscreens/LoadScreenKarazhan.webp", bossCount: 5, abbrev: "Kara" },
  "Karazhan Crypts": { background: "/images/loadingscreens/LoadscreenKarazhanCrypt.webp", bossCount: 3, abbrev: "Crypt" },
  "Hateforge Quarry": { background: "/images/loadingscreens/LoadScreenHateforge.webp", bossCount: 4, abbrev: "HQ" },
  "Gilneas City": { background: "/images/loadingscreens/LoadScreenGilneasCity.webp", bossCount: 3, abbrev: "Gilneas" },
  "World Bosses": { background: "/images/loadingscreens/LoadScreenRaid.webp", abbrev: "World" },
  // Dungeons
  "Black Morass": { background: "/images/loadingscreens/LoadScreenCavernsTime.webp", bossCount: 4, abbrev: "BM" },
  "Blackrock Spire": { background: "/images/loadingscreens/LoadScreenBlackrockSpire.webp", abbrev: "BRS" },
  "Upper Blackrock Spire": { background: "/images/loadingscreens/LoadScreenBlackrockSpire.webp", bossCount: 5, abbrev: "UBRS" },
  "Lower Blackrock Spire": { background: "/images/loadingscreens/LoadScreenBlackrockSpire.webp", abbrev: "LBRS" },
  "Deadmines": { background: "/images/loadingscreens/LoadScreenDeadmines.webp", bossCount: 8, abbrev: "DM" },
  "Shadowfang Keep": { background: "/images/loadingscreens/LoadScreenShadowFangKeep.webp", abbrev: "SFK" },
  "Scarlet Monastery": { background: "/images/loadingscreens/LoadScreenMonastery.webp", abbrev: "SM" },
  "Scarlet Monastery Library": { background: "/images/loadingscreens/LoadScreenMonastery.webp", bossCount: 3, abbrev: "SM Lib" },
  "Scarlet Monastery Cathedral": { background: "/images/loadingscreens/LoadScreenMonastery.webp", bossCount: 2, abbrev: "SM Cath" },
  "Scarlet Monastery Graveyard": { background: "/images/loadingscreens/LoadScreenMonastery.webp", abbrev: "SM GY" },
  "Scarlet Monastery Armory": { background: "/images/loadingscreens/LoadScreenMonastery.webp", abbrev: "SM Arm" },
  "Stratholme": { background: "/images/loadingscreens/LoadScreenStrathome.webp", abbrev: "Strat" },
  "Scholomance": { background: "/images/loadingscreens/LoadScreenScholomance.webp", abbrev: "Scholo" },
  "Blackrock Depths": { background: "/images/loadingscreens/LoadScreenBlackrockDepths.webp", abbrev: "BRD" },
  "Dire Maul": { background: "/images/loadingscreens/LoadScreenDireMaul.webp", abbrev: "DM" },
  "Maraudon": { background: "/images/loadingscreens/LoadScreenMaraudon.webp", abbrev: "Mara" },
  "Sunken Temple": { background: "/images/loadingscreens/LoadScreenSunkenTemple.webp", abbrev: "ST" },
  "Zul'Farrak": { background: "/images/loadingscreens/LoadScreenZulFarrak.webp", abbrev: "ZF" },
  "Uldaman": { background: "/images/loadingscreens/LoadScreenUldaman.webp", abbrev: "Ulda" },
  "Razorfen Downs": { background: "/images/loadingscreens/LoadScreenRazorfenDowns.webp", abbrev: "RFD" },
  "Razorfen Kraul": { background: "/images/loadingscreens/LoadScreenRazorfenKraul.webp", abbrev: "RFK" },
  "Wailing Caverns": { background: "/images/loadingscreens/LoadScreenWailingCaverns.webp", abbrev: "WC" },
  "Blackfathom Deeps": { background: "/images/loadingscreens/LoadScreenBlackFathomDeeps.webp", abbrev: "BFD" },
  "Gnomeregan": { background: "/images/loadingscreens/LoadScreenGnomeregan.webp", abbrev: "Gnomer" },
  "Ragefire Chasm": { background: "/images/loadingscreens/LoadScreenRagefireChasm.webp", bossCount: 4, abbrev: "RFC" },
  "Stormwind Stockade": { background: "/images/loadingscreens/LoadScreenStormwindStockade.webp", abbrev: "Stocks" },
  "Caverns of Time": { background: "/images/loadingscreens/LoadScreenCavernsTime.webp", abbrev: "CoT" },
};

export const DEFAULT_BACKGROUND = "/images/loadingscreens/LoadScreenDungeon.webp";

export function getInstanceConfig(name: string): InstanceConfig | undefined {
  return INSTANCE_CONFIG[name];
}

export function getInstanceBackground(name: string): string {
  return INSTANCE_CONFIG[name]?.background ?? DEFAULT_BACKGROUND;
}

export function getInstanceAbbrev(name: string): string {
  return INSTANCE_CONFIG[name]?.abbrev ?? name;
}
