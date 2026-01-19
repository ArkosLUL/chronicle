import type { Meta, StoryObj } from "@storybook/react-vite";
import { InstancePageView, type Instance, type Encounter, type EnemyUnit } from "./InstancePage";
import type { PlayerMetricChartData } from "@/components/ui/PlayerMetricChart/PlayerMetricChart";
import type { InstancePlayer, InstanceUnit, WoWHeroClasses, WoWHeroRaces } from "@/api/typesGenerated";
import { GUID } from "@/lib/guid/guid";

const meta = {
  title: "Pages/Instance",
  component: InstancePageView,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof InstancePageView>;

export default meta;
type Story = StoryObj<typeof meta>;

// Extended name list for 40-player raids
const playerNames = [
  "Shadowblade", "Pyroblast", "Darkbinder", "Ragefury", "Markshot",
  "Moonkin", "Shadowweaver", "Backstabber", "Frostbolt", "Demonlord",
  "Thunderstrike", "Icevein", "Soulreaper", "Bladestorm", "Arcanist",
  "Naturewrath", "Holybolt", "Venomfang", "Earthshaker", "Firestorm",
  "Nightstalker", "Sunfire", "Deathwhisper", "Ironclad", "Swiftarrow",
  "Starfall", "Bloodfury", "Frostweaver", "Hellscream", "Lightbane",
  "Stormcaller", "Voidwalker", "Berserker", "Hexmaster", "Wildkin",
  "Crusader", "Plaguebringer", "Windrunner", "Emberstrike", "Moonshadow",
  "Doomhammer", "Silentshot", "Ragnarok", "Felfire", "Astralwing",
];

// WoW class mapping (uppercase for API types)
const classMapping: { display: string; api: WoWHeroClasses }[] = [
  { display: "Rogue", api: "ROGUE" },
  { display: "Mage", api: "MAGE" },
  { display: "Warlock", api: "WARLOCK" },
  { display: "Warrior", api: "WARRIOR" },
  { display: "Hunter", api: "HUNTER" },
  { display: "Druid", api: "DRUID" },
  { display: "Priest", api: "PRIEST" },
  { display: "Paladin", api: "PALADIN" },
  { display: "Shaman", api: "SHAMAN" },
];

const races: WoWHeroRaces[] = ["Human", "Dwarf", "NightElf", "Gnome", "Orc", "Troll", "Tauren", "Scourge"];

// Generate a mock player GUID (high bits = 0x0000 for players)
function mockPlayerGuid(index: number): GUID {
  // Player GUIDs have high 16 bits with 0x00f0 mask = 0x0000
  const value = BigInt(0x0000_0000_0001_0000) + BigInt(index);
  return GUID.fromBigInt(value);
}

// Generate a mock creature GUID (high bits with 0x00f0 mask = 0x0030 for creatures)
function mockCreatureGuid(entry: number, spawnId: number): GUID {
  // Creature GUIDs: high = 0xF130, entry in bits 24-47, spawn in low 24
  // Format: 0xF130_EEEE_EEXX_XXXX where E=entry (24 bits shifted), X=spawn
  const high = BigInt(0xF130) << BigInt(48);
  const entryBits = BigInt(entry & 0xFFFFFF) << BigInt(24);
  const spawnBits = BigInt(spawnId & 0xFFFFFF);
  return GUID.fromBigInt(high | entryBits | spawnBits);
}

// Generate mock players map
function mockPlayersMap(playerCount: number): Record<string, InstancePlayer> {
  const players: Record<string, InstancePlayer> = {};
  for (let i = 0; i < playerCount; i++) {
    const guid = mockPlayerGuid(i + 1);
    const classInfo = classMapping[i % classMapping.length];
    players[guid.toString()] = {
      name: playerNames[i % playerNames.length] + (i >= playerNames.length ? `${Math.floor(i / playerNames.length) + 1}` : ""),
      class: classInfo.api,
      race: races[i % races.length],
    };
  }
  return players;
}

// Specs for chart display
const specsByClass: Record<string, string[]> = {
  Rogue: ["Combat", "Assassination", "Subtlety"],
  Mage: ["Fire", "Frost", "Arcane"],
  Warlock: ["Affliction", "Demonology", "Destruction"],
  Warrior: ["Fury", "Arms", "Protection"],
  Hunter: ["Marksmanship", "Beast Mastery", "Survival"],
  Druid: ["Balance", "Feral"],
  Priest: ["Shadow"],
  Paladin: ["Retribution"],
  Shaman: ["Enhancement", "Elemental"],
};

// Mock DPS data generator - supports up to 40 players
function mockDpsData(playerCount: number = 40): PlayerMetricChartData[] {
  // Generate with some variance to make it realistic
  return Array.from({ length: playerCount }, (_, i) => {
    const classInfo = classMapping[i % classMapping.length];
    const guid = mockPlayerGuid(i + 1);
    const specs = specsByClass[classInfo.display] || ["Unknown"];
    // Top players do ~800-1200 DPS, falls off toward bottom
    const baseValue = 1200 - (i * 25) + (Math.random() * 150 - 75);
    return {
      playerID: guid.toString(),
      playerName: playerNames[i % playerNames.length] + (i >= playerNames.length ? `${Math.floor(i / playerNames.length) + 1}` : ""),
      className: classInfo.display,
      specialization: specs[Math.floor(Math.random() * specs.length)],
      value: Math.max(50, Math.round(baseValue * 10) / 10),
    };
  }).sort((a, b) => b.value - a.value); // Sort by DPS descending
}

// Mock Healing data generator - supports up to 15 healers
// Healers use player GUIDs starting after DPS (offset by 100 to avoid overlap)
function mockHealingData(healerCount: number = 10): PlayerMetricChartData[] {
  const healerClasses = [
    { className: "Priest", specs: ["Holy", "Discipline"] },
    { className: "Shaman", specs: ["Restoration"] },
    { className: "Druid", specs: ["Restoration"] },
    { className: "Paladin", specs: ["Holy"] },
  ];

  const healerNames = [
    "Lifebinder", "Earthmender", "Natureheal", "Lightbringer", "Holylight",
    "Soulhealer", "Renewlife", "Manaspring", "Spiritguide", "Gracetouch",
    "Divinehope", "Rejuvenate", "Puritybeam", "Tranquility", "Restorative",
  ];

  return Array.from({ length: healerCount }, (_, i) => {
    const classInfo = healerClasses[i % healerClasses.length];
    const guid = mockPlayerGuid(100 + i + 1); // Offset for healers
    const baseHealing = 500 - (i * 30) + (Math.random() * 80 - 40);
    const overhealPercent = 0.1 + Math.random() * 0.25; // 10-35% overheal
    
    return {
      playerID: guid.toString(),
      playerName: healerNames[i % healerNames.length],
      className: classInfo.className,
      specialization: classInfo.specs[Math.floor(Math.random() * classInfo.specs.length)],
      value: Math.max(100, Math.round(baseHealing * 10) / 10),
      stackedValue: Math.round(baseHealing * overhealPercent * 10) / 10,
    };
  }).sort((a, b) => b.value - a.value);
}

// Simple hash function for generating consistent entry IDs from names
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash) % 100000;
}

// Mock enemy data generator - returns enemies with GUID-based IDs
function mockEnemyData(encounterName: string, boss: boolean): EnemyUnit[] {
  // Define some thematic adds based on encounter
  const addsByEncounter: Record<string, string[]> = {
    "Lucifron": ["Flamewaker Protector", "Flamewaker Protector"],
    "Magmadar": [],
    "Gehennas": ["Flamewaker", "Flamewaker"],
    "Garr": ["Firesworn", "Firesworn", "Firesworn", "Firesworn", "Firesworn", "Firesworn", "Firesworn", "Firesworn"],
    "Baron Geddon": [],
    "Shazzrah": [],
    "Sulfuron Harbinger": ["Flamewaker Priest", "Flamewaker Priest", "Flamewaker Priest", "Flamewaker Priest"],
    "Golemagg the Incinerator": ["Core Rager", "Core Rager"],
    "Majordomo Executus": ["Flamewaker Healer", "Flamewaker Healer", "Flamewaker Healer", "Flamewaker Healer", "Flamewaker Elite", "Flamewaker Elite", "Flamewaker Elite", "Flamewaker Elite"],
    "Ragnaros": ["Son of Flame", "Son of Flame", "Son of Flame", "Son of Flame", "Son of Flame", "Son of Flame", "Son of Flame", "Son of Flame"],
    "Onyxia": ["Onyxian Whelp", "Onyxian Whelp", "Onyxian Whelp", "Onyxian Whelp", "Onyxian Whelp", "Onyxian Whelp"],
    "High Inquisitor Fairbanks": [],
    "Scarlet Commander Mograine": [],
    "High Inquisitor Whitemane": ["Scarlet Commander Mograine"],
  };

  const adds = addsByEncounter[encounterName] || [];
  const enemies: EnemyUnit[] = [];

  // Add the main boss/enemy
  if (boss) {
    const bossEntry = hashString(encounterName);
    const bossGuid = mockCreatureGuid(bossEntry, 1);
    enemies.push({
      id: bossGuid.toString(),
      name: encounterName,
      damageTaken: Math.round(500000 + Math.random() * 200000),
      damageDone: Math.round(150000 + Math.random() * 50000),
    });
  }

  // Add the adds
  adds.forEach((addName, i) => {
    const addEntry = hashString(addName);
    const addGuid = mockCreatureGuid(addEntry, i + 2); // spawnId starts at 2
    enemies.push({
      id: addGuid.toString(),
      name: addName,
      damageTaken: Math.round(50000 + Math.random() * 30000),
      damageDone: Math.round(20000 + Math.random() * 15000),
    });
  });

  return enemies;
}

// Create encounter with timestamps
function createEncounter(
  id: string,
  name: string,
  boss: boolean,
  kill: boolean,
  startMinutes: number,
  durationSeconds: number,
  withMetrics: boolean = true
): Encounter {
  const baseTime = new Date("2026-01-15T19:00:00");
  const startTime = new Date(baseTime.getTime() + startMinutes * 60 * 1000);
  const endTime = new Date(startTime.getTime() + durationSeconds * 1000);

  const enemies = withMetrics ? mockEnemyData(name, boss) : [];

  // Remaining enemies are those that weren't killed
  const remaining = enemies
    .filter((_, i) => !kill || (i !== 0 && Math.random() < 0.2))
    .map(e => e.id);

  return {
    id,
    name,
    boss,
    kill,
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString(),
    ...(withMetrics && {
      dps: mockDpsData(40),
      healing: mockHealingData(10),
      damageTaken: mockDpsData(40).map((d) => ({ ...d, value: d.value * 0.3 })),
      enemies,
      remaining: kill ? [] : remaining, // No remaining if it's a kill
    }),
  };
}

// Helper to build a complete instance with all lookups
function createInstance(
  id: string,
  name: string,
  realm: string,
  startTime: string,
  endTime: string,
  encounters: Encounter[],
  dpsPlayerCount: number = 40,
  healerCount: number = 10
): Instance {
  // Collect all unique enemies across all encounters
  const allEnemies: EnemyUnit[] = [];
  for (const enc of encounters) {
    if (enc.enemies) {
      allEnemies.push(...enc.enemies);
    }
  }

  // Build units lookup from enemies
  const units: Record<string, InstanceUnit> = {};
  for (const enemy of allEnemies) {
    if (!units[enemy.id]) {
      // Parse entry from the GUID if possible
      let entry = 0;
      try {
        const guid = GUID.fromString(enemy.id);
        const result = guid.getEntry();
        if (result.ok) {
          entry = result.entry;
        }
      } catch {
        // Fallback if GUID parsing fails
        entry = hashString(enemy.name);
      }
      units[enemy.id] = {
        name: enemy.name,
        owner: null,
        entry,
      };
    }
  }

  // Build players lookup (DPS + healers)
  const players = mockPlayersMap(dpsPlayerCount);
  // Add healer players
  for (let i = 0; i < healerCount; i++) {
    const guid = mockPlayerGuid(100 + i + 1);
    const healerClasses: WoWHeroClasses[] = ["PRIEST", "SHAMAN", "DRUID", "PALADIN"];
    const healerNames = [
      "Lifebinder", "Earthmender", "Natureheal", "Lightbringer", "Holylight",
      "Soulhealer", "Renewlife", "Manaspring", "Spiritguide", "Gracetouch",
    ];
    players[guid.toString()] = {
      name: healerNames[i % healerNames.length],
      class: healerClasses[i % healerClasses.length],
      race: races[i % races.length],
    };
  }

  return {
    id,
    name,
    realm,
    startTime,
    endTime,
    encounters,
    players,
    units,
  };
}

// Full Scarlet Monastery Cathedral run
const smCathedralInstance: Instance = createInstance(
  "instance-sm-cathedral",
  "Scarlet Monastery Cathedral",
  "Turtle WoW",
  "2026-01-15T19:00:00Z",
  "2026-01-15T19:45:00Z",
  [
    // Trash encounters
    createEncounter("trash-1", "Scarlet Myrmidon", false, true, 2, 24, false),
    createEncounter("trash-2", "Scarlet Defender", false, true, 5, 35, false),
    createEncounter("trash-3", "Scarlet Myrmidon", false, true, 8, 24, false),
    createEncounter("trash-4", "Scarlet Wizard", false, true, 10, 31, false),
    createEncounter("trash-5", "Scarlet Centurion", false, false, 12, 198, false), // Wipe!
    createEncounter("trash-6", "Scarlet Centurion", false, true, 16, 24, false),
    createEncounter("trash-7", "Scarlet Monk", false, true, 18, 56, false),
    createEncounter("trash-8", "Scarlet Champion", false, true, 21, 45, false),
    // Boss encounters
    createEncounter("boss-1", "High Inquisitor Fairbanks", true, true, 25, 126),
    createEncounter("boss-2", "Scarlet Commander Mograine", true, false, 30, 80), // Wipe
    createEncounter("boss-3", "Scarlet Commander Mograine", true, true, 35, 126),
    createEncounter("boss-4", "High Inquisitor Whitemane", true, true, 40, 180),
  ]
);

// Molten Core raid
const moltenCoreInstance: Instance = createInstance(
  "instance-mc",
  "Molten Core",
  "Turtle WoW",
  "2026-01-15T20:00:00Z",
  "2026-01-15T23:30:00Z",
  [
    // Some trash
    createEncounter("mc-trash-1", "Molten Giant", false, true, 5, 45, false),
    createEncounter("mc-trash-2", "Molten Giant", false, true, 8, 50, false),
    createEncounter("mc-trash-3", "Firelord", false, true, 12, 60, false),
    createEncounter("mc-trash-4", "Lava Annihilator", false, true, 18, 55, false),
    createEncounter("mc-trash-5", "Lava Surger", false, true, 22, 40, false),
    // Bosses
    createEncounter("mc-boss-1", "Lucifron", true, true, 30, 95),
    createEncounter("mc-boss-2", "Magmadar", true, true, 45, 120),
    createEncounter("mc-boss-3", "Gehennas", true, true, 65, 105),
    createEncounter("mc-boss-4", "Garr", true, false, 85, 180), // Wipe
    createEncounter("mc-boss-5", "Garr", true, true, 100, 210),
    createEncounter("mc-boss-6", "Baron Geddon", true, true, 120, 150),
    createEncounter("mc-boss-7", "Shazzrah", true, true, 140, 90),
    createEncounter("mc-boss-8", "Sulfuron Harbinger", true, true, 160, 130),
    createEncounter("mc-boss-9", "Golemagg the Incinerator", true, true, 180, 145),
    createEncounter("mc-boss-10", "Majordomo Executus", true, true, 200, 180),
    createEncounter("mc-boss-11", "Ragnaros", true, false, 220, 240), // Wipe
    createEncounter("mc-boss-12", "Ragnaros", true, false, 235, 200), // Wipe again
    createEncounter("mc-boss-13", "Ragnaros", true, true, 250, 300),
  ]
);

// Minimal instance with just bosses
const bossOnlyInstance: Instance = createInstance(
  "instance-boss-only",
  "Onyxia's Lair",
  "Turtle WoW",
  "2026-01-15T21:00:00Z",
  "2026-01-15T21:15:00Z",
  [
    createEncounter("ony-1", "Onyxia", true, false, 2, 180), // Wipe
    createEncounter("ony-2", "Onyxia", true, true, 8, 240),
  ]
);

export const Default: Story = {
  args: {
    instance: smCathedralInstance,
    onBack: () => console.log("Back clicked"),
  },
};

export const MoltenCore: Story = {
  args: {
    instance: moltenCoreInstance,
    onBack: () => console.log("Back clicked"),
  },
};

export const BossOnly: Story = {
  args: {
    instance: bossOnlyInstance,
    onBack: () => console.log("Back clicked"),
  },
};

export const WipeSelected: Story = {
  args: {
    instance: moltenCoreInstance,
    selectedEncounterIds: ["mc-boss-4"], // Garr wipe
    onBack: () => console.log("Back clicked"),
  },
};

export const MultipleSelected: Story = {
  args: {
    instance: moltenCoreInstance,
    selectedEncounterIds: ["mc-boss-1", "mc-boss-2", "mc-boss-3"], // First 3 bosses
    onBack: () => console.log("Back clicked"),
  },
  parameters: {
    docs: {
      description: {
        story: "Multiple encounters selected - metrics are merged (summed by player). Use Ctrl/Cmd+click to multi-select.",
      },
    },
  },
};

export const NoBackButton: Story = {
  args: {
    instance: smCathedralInstance,
  },
};
