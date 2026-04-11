/**
 * Equipment bridge: fetches ItemDisplayData from Chronicle API for each equipped
 * gear slot and builds the EquipmentOptions the model viewer expects.
 *
 * Ported from the Chronicle demo in the classic-wow-model-viewer repo.
 */
import type { EquipmentOptions, BodyArmor } from "classic-wow-model-viewer";
import type { ItemDisplayData, PlayerOutfit } from "@/api/typesGenerated";

const DISPLAY_API = "/api/v1/internal/gamedata/display/item";

const TEXTURE_REGION_DIRS = [
  "ArmUpperTexture",
  "ArmLowerTexture",
  "HandTexture",
  "TorsoUpperTexture",
  "TorsoLowerTexture",
  "LegUpperTexture",
  "LegLowerTexture",
  "FootTexture",
];

type SlotKey = "weapon" | "offhand" | "head" | "shoulder" | "chest" | "legs" | "feet" | "hands";

/**
 * PlayerOutfit index → SlotKey (only visual slots that affect the 3D model).
 * Indices match the PlayerOutfit[19] array order defined in types.ts.
 */
const OUTFIT_TO_SLOT: Partial<Record<number, SlotKey>> = {
  0: "head",
  2: "shoulder",
  4: "chest",
  6: "legs",
  7: "feet",
  9: "hands",
  15: "weapon",
  16: "offhand",
};

function slugify(filename: string): string {
  return filename.replace(/\.\w+$/, "").toLowerCase().replace(/_/g, "-");
}

function texBase(regionIdx: number, texName: string): string {
  return `/item-textures/${TEXTURE_REGION_DIRS[regionIdx]}/${texName.replace(/\.blp$/i, "")}`;
}

/** Result of fetching display data: resolved items + outfit indices that failed. */
interface FetchResult {
  items: Partial<Record<SlotKey, ItemDisplayData>>;
  /** Outfit indices (into PlayerOutfit[19]) where the display API returned 404 or failed. */
  failedSlots: Set<number>;
}

/** Fetch display data for all equipped items in parallel. */
async function fetchDisplayData(gear: PlayerOutfit): Promise<FetchResult> {
  const items: Partial<Record<SlotKey, ItemDisplayData>> = {};
  const failedSlots = new Set<number>();
  const fetches: Promise<void>[] = [];

  for (const [idxStr, slotKey] of Object.entries(OUTFIT_TO_SLOT)) {
    const idx = Number(idxStr);
    const slot = gear[idx];
    if (!slot?.item_id || slot.item_id <= 0) continue;

    // Use transmog appearance if present, otherwise the real item
    const itemId = slot.transmog_id && slot.transmog_id > 0 ? slot.transmog_id : slot.item_id;

    fetches.push(
      fetch(`${DISPLAY_API}/${itemId}`)
        .then((r) => {
          if (!r.ok) {
            failedSlots.add(idx);
            return null;
          }
          return r.json();
        })
        .then((data: ItemDisplayData | null) => {
          if (data) items[slotKey!] = data;
        })
        .catch(() => {
          failedSlots.add(idx);
        }),
    );
  }
  await Promise.all(fetches);
  return { items, failedSlots };
}

/** Reverse map from SlotKey → outfit index */
const SLOT_TO_OUTFIT: Record<SlotKey, number> = {
  head: 0, shoulder: 2, chest: 4, legs: 6, feet: 7, hands: 9, weapon: 15, offhand: 16,
};

interface BuildResult {
  equipment: EquipmentOptions;
  /** Maps CDN-relative path prefixes → outfit index. Used to trace CDN 404s back to gear slots. */
  pathToSlot: Map<string, number>;
}

/** Build EquipmentOptions from fetched display data. (Same logic as Chronicle demo) */
function buildEquipment(equipped: Partial<Record<SlotKey, ItemDisplayData>>): BuildResult {
  const eq: EquipmentOptions = {};
  const armor: BodyArmor = {};
  const pathToSlot = new Map<string, number>();

  /** Register a CDN path prefix → outfit index mapping. */
  function track(path: string, slot: SlotKey) {
    pathToSlot.set(path, SLOT_TO_OUTFIT[slot]);
  }

  // Weapon
  const w = equipped.weapon;
  if (w?.model_name?.[0]) {
    const slug = slugify(w.model_name[0]);
    const path = `/items/weapon/${slug}`;
    eq.weapon = {
      path,
      texture: w.model_texture?.[0]
        ? `/items/weapon/${slug}/textures/${slugify(w.model_texture[0])}.tex`
        : undefined,
    };
    track(path, "weapon");
  }

  // Offhand
  const oh = equipped.offhand;
  if (oh?.model_name?.[0]) {
    const dir = oh.inventory_type === 14 ? "shield" : "weapon";
    const slug = slugify(oh.model_name[0]);
    const path = `/items/${dir}/${slug}`;
    eq.offhand = {
      path,
      texture: oh.model_texture?.[0]
        ? `/items/${dir}/${slug}/textures/${slugify(oh.model_texture[0])}.tex`
        : undefined,
    };
    track(path, "offhand");
  }

  // Head
  const head = equipped.head;
  if (head?.model_name?.[0]) {
    armor.helmet = slugify(head.model_name[0]);
    if (head.geoset_vis_id?.[0] || head.geoset_vis_id?.[1]) {
      armor.helmetGeosetVisID = [head.geoset_vis_id[0], head.geoset_vis_id[1]];
    }
    if (head.model_texture?.[0]) armor.helmetTexture = slugify(head.model_texture[0]);
    track(`/items/head/${armor.helmet}`, "head");
  }

  // Shoulder
  const shoulder = equipped.shoulder;
  if (shoulder?.model_name?.[0]) {
    armor.shoulderSlug = slugify(shoulder.model_name[0].replace(/^[LR]Shoulder_/i, ""));
    armor.shoulderHasRight = true;
    if (shoulder.model_texture?.[0]) armor.shoulderTexture = slugify(shoulder.model_texture[0]);
    track(`/items/shoulder/${armor.shoulderSlug}`, "shoulder");
  }

  // Chest
  const chest = equipped.chest;
  if (chest) {
    const tex = chest.texture;
    const gg = chest.geoset_group;
    if (tex[0]) { armor.armUpperBase = texBase(0, tex[0]); track(armor.armUpperBase, "chest"); }
    if (tex[3]) { armor.torsoUpperBase = texBase(3, tex[3]); track(armor.torsoUpperBase, "chest"); }
    if (tex[4]) { armor.torsoLowerBase = texBase(4, tex[4]); track(armor.torsoLowerBase, "chest"); }
    if (gg[0] > 0) armor.sleeveGeoset = gg[0] + 1;
    if (gg[2] > 0) armor.robeGeoset = gg[2] + 1;
    if (armor.robeGeoset) {
      if (tex[5]) { armor.legUpperBase = texBase(5, tex[5]); track(armor.legUpperBase, "chest"); }
      if (tex[6]) { armor.legLowerBase = texBase(6, tex[6]); track(armor.legLowerBase, "chest"); }
      if (tex[1]) { armor.armLowerBase = texBase(1, tex[1]); track(armor.armLowerBase, "chest"); }
    }
  }

  // Legs
  const legs = equipped.legs;
  if (legs && !armor.robeGeoset) {
    if (legs.texture[5]) { armor.legUpperBase = texBase(5, legs.texture[5]); track(armor.legUpperBase, "legs"); }
    if (legs.texture[6]) { armor.legLowerBase = texBase(6, legs.texture[6]); track(armor.legLowerBase, "legs"); }
    if (legs.geoset_group[2] > 0) armor.robeGeoset = legs.geoset_group[2] + 1;
  }

  // Boots
  const boots = equipped.feet;
  if (boots) {
    if (boots.texture[7]) { armor.footBase = texBase(7, boots.texture[7]); track(armor.footBase, "feet"); }
    if (boots.geoset_group[0] > 0) armor.footGeoset = boots.geoset_group[0] + 1;
    if (!armor.robeGeoset && boots.texture[6]) { armor.legLowerBase = texBase(6, boots.texture[6]); track(armor.legLowerBase, "feet"); }
  }

  // Gloves
  const gloves = equipped.hands;
  if (gloves) {
    if (gloves.texture[2]) { armor.handBase = texBase(2, gloves.texture[2]); track(armor.handBase, "hands"); }
    if (gloves.geoset_group[0] > 0) armor.handGeoset = gloves.geoset_group[0] + 1;
    if (gloves.texture[1]) { armor.armLowerBase = texBase(1, gloves.texture[1]); track(armor.armLowerBase, "hands"); }
    if (!armor.robeGeoset && gloves.geoset_group[1] > 0) armor.wristGeoset = gloves.geoset_group[1] + 1;
  }

  if (Object.values(armor).some((v) => v)) eq.armor = armor;
  return { equipment: eq, pathToSlot };
}

export interface ResolvedEquipment {
  equipment: EquipmentOptions;
  /** Maps CDN-relative path prefixes → outfit index. Used to trace CDN 404s back to gear slots. */
  pathToSlot: Map<string, number>;
  /** Outfit indices (into PlayerOutfit[19]) where display data could not be loaded. */
  failedSlots: Set<number>;
}

/** Fetch display data for gear and return EquipmentOptions + any failed slot indices. */
export async function resolveEquipment(gear: PlayerOutfit): Promise<ResolvedEquipment> {
  const { items, failedSlots } = await fetchDisplayData(gear);
  const { equipment, pathToSlot } = buildEquipment(items);
  return { equipment, pathToSlot, failedSlots };
}
