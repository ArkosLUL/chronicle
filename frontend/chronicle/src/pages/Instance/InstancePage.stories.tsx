import type { Meta, StoryObj } from "@storybook/react-vite";
import { InstancePageView, type Instance, type Encounter, type EnemyUnit } from "./InstancePage";
import type { PlayerMetricChartData } from "@/components/ui/PlayerMetricChart/PlayerMetricChart";

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

// Mock DPS data generator - supports up to 40 players
function mockDpsData(playerCount: number = 40): PlayerMetricChartData[] {
  const classes = [
    { className: "Rogue", specs: ["Combat", "Assassination", "Subtlety"] },
    { className: "Mage", specs: ["Fire", "Frost", "Arcane"] },
    { className: "Warlock", specs: ["Affliction", "Demonology", "Destruction"] },
    { className: "Warrior", specs: ["Fury", "Arms", "Protection"] },
    { className: "Hunter", specs: ["Marksmanship", "Beast Mastery", "Survival"] },
    { className: "Druid", specs: ["Balance", "Feral"] },
    { className: "Priest", specs: ["Shadow"] },
    { className: "Paladin", specs: ["Retribution"] },
    { className: "Shaman", specs: ["Enhancement", "Elemental"] },
  ];

  // Generate with some variance to make it realistic
  return Array.from({ length: playerCount }, (_, i) => {
    const classInfo = classes[i % classes.length];
    // Top players do ~800-1200 DPS, falls off toward bottom
    const baseValue = 1200 - (i * 25) + (Math.random() * 150 - 75);
    return {
      playerID: `player-${i + 1}`,
      playerName: playerNames[i % playerNames.length] + (i >= playerNames.length ? `${Math.floor(i / playerNames.length) + 1}` : ""),
      className: classInfo.className,
      specialization: classInfo.specs[Math.floor(Math.random() * classInfo.specs.length)],
      value: Math.max(50, Math.round(baseValue * 10) / 10),
    };
  }).sort((a, b) => b.value - a.value); // Sort by DPS descending
}

// Mock Healing data generator - supports up to 15 healers
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
    const baseHealing = 500 - (i * 30) + (Math.random() * 80 - 40);
    const overhealPercent = 0.1 + Math.random() * 0.25; // 10-35% overheal
    
    return {
      playerID: `healer-${i + 1}`,
      playerName: healerNames[i % healerNames.length],
      className: classInfo.className,
      specialization: classInfo.specs[Math.floor(Math.random() * classInfo.specs.length)],
      value: Math.max(100, Math.round(baseHealing * 10) / 10),
      stackedValue: Math.round(baseHealing * overhealPercent * 10) / 10,
    };
  }).sort((a, b) => b.value - a.value);
}

// Mock enemy data generator
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
    enemies.push({
      id: `enemy-${encounterName.toLowerCase().replace(/\s+/g, '-')}`,
      name: encounterName,
      damageTaken: Math.round(500000 + Math.random() * 200000),
      damageDone: Math.round(150000 + Math.random() * 50000),
    });
  }

  // Add the adds
  const addCounts = new Map<string, number>();
  adds.forEach((addName, i) => {
    const count = (addCounts.get(addName) || 0) + 1;
    addCounts.set(addName, count);
    enemies.push({
      id: `enemy-add-${i}-${addName.toLowerCase().replace(/\s+/g, '-')}`,
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
      enemies: mockEnemyData(name, boss),
    }),
  };
}

// Full Scarlet Monastery Cathedral run
const smCathedralInstance: Instance = {
  id: "instance-sm-cathedral",
  name: "Scarlet Monastery Cathedral",
  realm: "Turtle WoW",
  startTime: "2026-01-15T19:00:00Z",
  endTime: "2026-01-15T19:45:00Z",
  encounters: [
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
  ],
};

// Molten Core raid
const moltenCoreInstance: Instance = {
  id: "instance-mc",
  name: "Molten Core",
  realm: "Turtle WoW",
  startTime: "2026-01-15T20:00:00Z",
  endTime: "2026-01-15T23:30:00Z",
  encounters: [
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
  ],
};

// Minimal instance with just bosses
const bossOnlyInstance: Instance = {
  id: "instance-boss-only",
  name: "Onyxia's Lair",
  realm: "Turtle WoW",
  startTime: "2026-01-15T21:00:00Z",
  endTime: "2026-01-15T21:15:00Z",
  encounters: [
    createEncounter("ony-1", "Onyxia", true, false, 2, 180), // Wipe
    createEncounter("ony-2", "Onyxia", true, true, 8, 240),
  ],
};

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
