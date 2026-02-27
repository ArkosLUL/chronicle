import type { Meta, StoryObj } from "@storybook/react-vite";
import { http, HttpResponse, delay } from "msw";
import { MemoryRouter } from "react-router-dom";
import { RecentRaids } from "./RecentRaids";
import type { RecentInstance, RecentInstancesResponse } from "@/api/typesGenerated";

// Generate mock data
function generateMockInstances(count: number, startIndex = 0): RecentInstance[] {
  const instances: RecentInstance[] = [];
  
  const instanceTypes = [
    { name: "Molten Core", bossCount: 10, playerRange: [35, 40] },
    { name: "Blackwing Lair", bossCount: 8, playerRange: [35, 40] },
    { name: "Onyxia's Lair", bossCount: 1, playerRange: [35, 40] },
    { name: "Zul'Gurub", bossCount: 10, playerRange: [18, 20] },
    { name: "Ruins of Ahn'Qiraj", bossCount: 6, playerRange: [18, 20] },
    { name: "Temple of Ahn'Qiraj", bossCount: 9, playerRange: [35, 40] },
    { name: "Naxxramas", bossCount: 15, playerRange: [35, 40] },
    { name: "World Bosses", bossCount: 4, playerRange: [30, 60] },
    { name: "Stratholme", bossCount: 5, playerRange: [1, 5] },
    { name: "Scholomance", bossCount: 6, playerRange: [1, 5] },
    { name: "Black Morass", bossCount: 7, playerRange: [1, 5] },
    // { name: "Blackrock Spire", bossCount: 7, playerRange: [8, 10] },
    // { name: "Blackrock Spire", bossCount: 6, playerRange: [8, 10] },
    { name: "Dire Maul", bossCount: 5, playerRange: [1, 5] },
  ];

  const uploaders = [
    "Emyrk", "DragonSlayer", "TrollHunter", "FrostMage", "ShadowPriest",
    "HolyPaladin", "FuryWarrior", "RogueAssassin", "BoomkinDruid", "RestoDruid",
    "ElementalShaman", "AfflictionLock", "BeastMasterHunter", "ProtWarrior", "DiscPriest"
  ];

  const realms = [
    { id: "851d2fd3-f9c5-4623-b714-924b59d916aa", name: "Ambershire" },
    { id: "f94d3103-1cd8-40e9-ad91-a2366de33354", name: "Tel'Abim" },
    { id: "bcf173a7-c94a-49fe-8930-27435d722fb7", name: "Nordanaar" },
    { id: "ad486d39-31dd-4eb6-a43d-7d469df4ffcf", name: "South Seas" },
  ];

  const bossNames: Record<string, string[]> = {
    "Molten Core": ["Lucifron", "Magmadar", "Gehennas", "Garr", "Shazzrah", "Baron Geddon", "Sulfuron Harbinger", "Golemagg", "Majordomo Executus", "Ragnaros"],
    "Blackwing Lair": ["Razorgore", "Vaelastrasz", "Broodlord Lashlayer", "Firemaw", "Ebonroc", "Flamegor", "Chromaggus", "Nefarian"],
    "Onyxia's Lair": ["Onyxia"],
    "Zul'Gurub": ["Jeklik", "Venoxis", "Mar'li", "Mandokir", "Thekal", "Arlokk", "Jin'do", "Hakkar", "Gahz'ranka", "Edge of Madness"],
    "Ruins of Ahn'Qiraj": ["Kurinnaxx", "General Rajaxx", "Moam", "Buru", "Ayamiss", "Ossirian"],
    "Temple of Ahn'Qiraj": ["Skeram", "Bug Trio", "Sartura", "Fankriss", "Viscidus", "Huhuran", "Twin Emperors", "Ouro", "C'Thun"],
    "Naxxramas": ["Anub'Rekhan", "Faerlina", "Maexxna", "Noth", "Heigan", "Loatheb", "Razuvious", "Gothik", "Four Horsemen", "Patchwerk", "Grobbulus", "Gluth", "Thaddius", "Sapphiron", "Kel'Thuzad"],
  };

  for (let i = 0; i < count; i++) {
    const idx = startIndex + i;
    const instanceType = instanceTypes[idx % instanceTypes.length];
    const realm = realms[idx % realms.length];
    const uploader = uploaders[idx % uploaders.length];
    
    // Randomize kill count
    const isFullClear = Math.random() > 0.3;
    const bossKills = isFullClear 
      ? instanceType.bossCount 
      : Math.floor(Math.random() * instanceType.bossCount);
    
    // Randomize player count within range
    const playerCount = instanceType.playerRange[0] + 
      Math.floor(Math.random() * (instanceType.playerRange[1] - instanceType.playerRange[0] + 1));
    
    // Generate duration (30min to 4 hours)
    const durationMs = (30 + Math.floor(Math.random() * 210)) * 60 * 1000;
    
    // Generate upload time (spread over last 7 days)
    const uploadedAt = new Date(Date.now() - (idx * 3600000) - Math.random() * 86400000);

    // Generate encounters
    const bosses = bossNames[instanceType.name] || Array.from({ length: instanceType.bossCount }, (_, j) => `Boss ${j + 1}`);
    const encounters = bosses.slice(0, instanceType.bossCount).map((name, j) => ({
      name,
      boss: true,
      kill: j < bossKills,
    }));

    instances.push({
      id: `${idx.toString().padStart(8, '0')}-0000-0000-0000-000000000000`,
      slug: `${instanceType.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${idx}`,
      name: instanceType.name,
      realm_id: realm.id,
      realm_name: realm.name,
      uploader_id: `user-${idx}`,
      uploader_name: uploader,
      uploaded_at: uploadedAt.toISOString(),
      player_count: playerCount,
      boss_count: instanceType.bossCount,
      boss_kills: bossKills,
      duration_ms: durationMs,
      encounters,
      has_youtube_video: idx % 2 === 0,
    });
  }

  return instances;
}

// Create pages of mock data
const TOTAL_ITEMS = 200;
const allMockInstances = generateMockInstances(TOTAL_ITEMS);

function getMockPage(
  cursor: string | null,
  limit: number,
  instanceFilters: string[] = [],
  hasVideo?: string | null,
  realmID?: string | null,
): RecentInstancesResponse {
  let startIdx = 0;

  if (cursor) {
    try {
      const decoded = JSON.parse(atob(cursor));
      startIdx = decoded.idx || 0;
    } catch {
      startIdx = 0;
    }
  }

  let filtered = allMockInstances;

  // Apply instance filters (multi-select)
  if (instanceFilters.length > 0) {
    const selected = new Set(instanceFilters);
    filtered = filtered.filter((instance) => selected.has(instance.name));
  }

  // Apply has video filter
  if (hasVideo === "true") {
    filtered = filtered.filter((instance) => instance.has_youtube_video);
  } else if (hasVideo === "false") {
    filtered = filtered.filter((instance) => !instance.has_youtube_video);
  }

  // Apply realm filter
  if (realmID) {
    filtered = filtered.filter((instance) => instance.realm_id === realmID);
  }

  const pageItems = filtered.slice(startIdx, startIdx + limit);
  const hasMore = startIdx + limit < filtered.length;

  const nextCursor = hasMore
    ? btoa(JSON.stringify({ idx: startIdx + limit }))
    : undefined;

  return {
    instances: pageItems,
    has_more: hasMore,
    next_cursor: nextCursor,
  };
}

const meta: Meta<typeof RecentRaids> = {
  title: "pages/RecentRaids",
  component: RecentRaids,
  tags: ["autodocs"],
  decorators: [
    (Story, context) => (
      <MemoryRouter initialEntries={context.parameters.initialEntries ?? ["/recent"]}>
        <div className="min-h-screen bg-background">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    msw: {
      handlers: [
        http.get("/api/v1/raidlogs/supported", async () =>
          HttpResponse.json({
            "Molten Core": "",
            "Blackwing Lair": "",
            "Onyxia's Lair": "",
            "Zul'Gurub": "",
            "Ruins of Ahn'Qiraj": "",
            "Temple of Ahn'Qiraj": "",
            "Naxxramas": "",
            "World Bosses": "",
            "Stratholme": "",
            "Scholomance": "",
            "Black Morass": "",
            "Dire Maul": "",
          }),
        ),
      ],
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default view with plenty of data to scroll through.
 * Shows infinite scroll behavior with 200 total items.
 */
export const Default: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("/api/v1/raidlogs/recent", async ({ request }) => {
          const url = new URL(request.url);
          const cursor = url.searchParams.get("cursor");
          const limit = parseInt(url.searchParams.get("limit") || "24");
          const instanceNames = url.searchParams.getAll("instance_name");
          const hasVideo = url.searchParams.get("has_video");
          const realmID = url.searchParams.get("realm_id");

          await delay(300); // Simulate network latency

          return HttpResponse.json(getMockPage(cursor, limit, instanceNames, hasVideo, realmID));
        }),
      ],
    },
  },
};

/**
 * Slow network simulation - shows loading states clearly.
 */
export const SlowNetwork: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("/api/v1/raidlogs/recent", async ({ request }) => {
          const url = new URL(request.url);
          const cursor = url.searchParams.get("cursor");
          const limit = parseInt(url.searchParams.get("limit") || "24");
          
          await delay(2000); // 2 second delay
          
          return HttpResponse.json(getMockPage(cursor, limit));
        }),
      ],
    },
  },
};

/**
 * Empty state - no raids uploaded yet.
 */
export const Empty: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("/api/v1/raidlogs/recent", async () => {
          await delay(300);
          return HttpResponse.json({
            instances: [],
            has_more: false,
          });
        }),
      ],
    },
  },
};

/**
 * Error state - API failure.
 */
export const Error: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("/api/v1/raidlogs/recent", async () => {
          await delay(300);
          return HttpResponse.error();
        }),
      ],
    },
  },
};

/**
 * Only Molten Core raids (simulates filtered view).
 */
export const MoltenCoreOnly: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("/api/v1/raidlogs/recent", async ({ request }) => {
          const url = new URL(request.url);
          const cursor = url.searchParams.get("cursor");
          const limit = parseInt(url.searchParams.get("limit") || "24");
          
          await delay(300);
          
          // Force filter to MC
          return HttpResponse.json(getMockPage(cursor, limit, ["Molten Core"]));
        }),
      ],
    },
  },
};

/**
 * Filtered view via URL params (category + multi-instance + video).
 */
export const FilteredByUrl: Story = {
  parameters: {
    initialEntries: ["/recent?cat=raid&inst=Molten%20Core,Blackwing%20Lair&vid=with"],
    msw: {
      handlers: [
        http.get("/api/v1/raidlogs/recent", async ({ request }) => {
          const url = new URL(request.url);
          const cursor = url.searchParams.get("cursor");
          const limit = parseInt(url.searchParams.get("limit") || "24");
          const instanceNames = url.searchParams.getAll("instance_name");
          const hasVideo = url.searchParams.get("has_video");
          const realmID = url.searchParams.get("realm_id");

          await delay(300);

          return HttpResponse.json(getMockPage(cursor, limit, instanceNames, hasVideo, realmID));
        }),
      ],
    },
  },
};

/**
 * Small dataset - only 5 items, no infinite scroll needed.
 */
export const SmallDataset: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("/api/v1/raidlogs/recent", async () => {
          await delay(300);
          return HttpResponse.json({
            instances: generateMockInstances(5),
            has_more: false,
          });
        }),
      ],
    },
  },
};

/**
 * Single item - minimal data.
 */
export const SingleItem: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("/api/v1/raidlogs/recent", async () => {
          await delay(300);
          return HttpResponse.json({
            instances: generateMockInstances(1),
            has_more: false,
          });
        }),
      ],
    },
  },
};

/**
 * Mixed content - dungeons and raids together.
 */
export const MixedContent: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("/api/v1/raidlogs/recent", async ({ request }) => {
          const url = new URL(request.url);
          const cursor = url.searchParams.get("cursor");
          const limit = parseInt(url.searchParams.get("limit") || "24");
          
          await delay(300);
          
          // Mix of all instance types
          return HttpResponse.json(getMockPage(cursor, limit));
        }),
      ],
    },
  },
};

/**
 * Mostly wipes - shows how partial clears look.
 */
export const MostlyWipes: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("/api/v1/raidlogs/recent", async () => {
          await delay(300);
          
          // Generate instances with mostly wipes
          const instances = generateMockInstances(24).map(inst => ({
            ...inst,
            boss_kills: Math.floor(inst.boss_count * 0.3), // Only 30% killed
            encounters: inst.encounters?.map((enc, i) => ({
              ...enc,
              kill: i < Math.floor((inst.encounters?.length || 0) * 0.3),
            })),
          }));
          
          return HttpResponse.json({
            instances,
            has_more: true,
            next_cursor: btoa(JSON.stringify({ idx: 24 })),
          });
        }),
      ],
    },
  },
};

/**
 * All full clears - celebratory view!
 */
export const AllFullClears: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("/api/v1/raidlogs/recent", async () => {
          await delay(300);
          
          // Generate instances with all full clears
          const instances = generateMockInstances(24).map(inst => ({
            ...inst,
            boss_kills: inst.boss_count,
            encounters: inst.encounters?.map(enc => ({
              ...enc,
              kill: true,
            })),
          }));
          
          return HttpResponse.json({
            instances,
            has_more: true,
            next_cursor: btoa(JSON.stringify({ idx: 24 })),
          });
        }),
      ],
    },
  },
};

/**
 * Speed runs - short duration raids.
 */
export const SpeedRuns: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("/api/v1/raidlogs/recent", async () => {
          await delay(300);
          
          // Generate instances with short durations
          const instances = generateMockInstances(24).map(inst => ({
            ...inst,
            duration_ms: (15 + Math.floor(Math.random() * 30)) * 60 * 1000, // 15-45 min
            boss_kills: inst.boss_count, // Full clears
            encounters: inst.encounters?.map(enc => ({
              ...enc,
              kill: true,
            })),
          }));
          
          return HttpResponse.json({
            instances,
            has_more: true,
            next_cursor: btoa(JSON.stringify({ idx: 24 })),
          });
        }),
      ],
    },
  },
};
