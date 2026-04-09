/**
 * Dispel processor - aggregates dispel events by caster and target (pure TS, worker-safe)
 *
 * Tracks both perspectives:
 * - "done": who performed dispels (grouped by caster)
 * - "received": whose auras were removed (grouped by target)
 *
 * Data is stored per dispel category (Magic, Curse, Disease, Poison, Other)
 * plus an "All" aggregate. The UI filters by category at render time.
 */

import type { DispelProcessorEvent, PanelProcessor, ProcessorContext } from "../processorTypes";
import { resolveEntity, extractGroupingFromPanelOption, extractPetModeFromPanelOption } from "../processors/resolveEntity";

// ============================================================================
// Dispel categories
// ============================================================================

export type DispelCategory = "All" | "Magic" | "Curse" | "Disease" | "Poison" | "Other";

export const ALL_DISPEL_CATEGORIES: DispelCategory[] = [
  "All", "Magic", "Curse", "Disease", "Poison", "Other",
];

/** Map raw dispelType enum value to a category. */
function toCategory(dispelType: number): DispelCategory {
  switch (dispelType) {
    case 1: return "Magic";
    case 2: return "Curse";
    case 3: return "Disease";
    case 4: return "Poison";
    default: return "Other"; // 0=None, 5=Stealth, 6=Invisibility
  }
}

// ============================================================================
// Data types
// ============================================================================

export interface DispelSpellData {
  spellId: number | null;
  name: string;
  count: number;
  dispelType: number;
}

export interface DispelEntityData {
  entityID: string;
  entityName: string;
  className: string;
  totalDispels: number;
  bySpell: Map<string, DispelSpellData>;
}

function createEntityData(id: string, name: string, cls: string): DispelEntityData {
  return { entityID: id, entityName: name, className: cls, totalDispels: 0, bySpell: new Map() };
}

// encounter -> category -> entityGuid -> data
type CategoryEntityMap = Map<DispelCategory, Map<string, DispelEntityData>>;

/**
 * A single dispel log entry for chronological display.
 */
export interface DispelLogEvent {
  dateMilli: number;       // Absolute timestamp
  offsetMilli: number;     // Time offset from encounter start
  encounterID: string;
  casterID: string;
  casterName: string;
  casterClass: string;
  targetID: string;
  targetName: string;
  targetClass: string;
  spellId: number | null;  // Spell ID of the aura that was dispelled
  spellName: string;       // The aura that was dispelled
  dispelType: number;      // Raw enum value
  category: DispelCategory;
}

export interface DispelResult {
  /** "done" perspective: keyed by caster */
  byCaster: Map<string, CategoryEntityMap>;
  /** "received" perspective: keyed by target */
  byTarget: Map<string, CategoryEntityMap>;
  /** Breakout for focus view – caster perspective (selected encounters only) */
  casterByAbility: Map<string, Map<string, number>>;
  /** Breakout for focus view – target perspective (selected encounters only) */
  targetByAbility: Map<string, Map<string, number>>;
  /** Chronological list of all dispel events for log view */
  DispelEvents: DispelLogEvent[];
}

// ============================================================================
// Helpers
// ============================================================================

function getOrCreateCategoryMap(
  perspectiveMap: Map<string, CategoryEntityMap>,
  encounterID: string,
): CategoryEntityMap {
  let catMap = perspectiveMap.get(encounterID);
  if (!catMap) {
    catMap = new Map<DispelCategory, Map<string, DispelEntityData>>();
    perspectiveMap.set(encounterID, catMap);
  }
  return catMap;
}

function accumulateEntity(
  catMap: CategoryEntityMap,
  category: DispelCategory,
  entityID: string,
  entityName: string,
  entityClass: string,
  spellId: number | null,
  spellName: string,
  dispelType: number,
) {
  // Key by spellId when available so same-name spells with different IDs get separate rows
  const key = spellId != null ? String(spellId) : (spellName || `unknown_${dispelType}`);
  const displayName = spellName || `Spell ${dispelType}`;

  // Accumulate into both "All" and the specific category
  for (const cat of [("All" as DispelCategory), category]) {
    let entityMap = catMap.get(cat);
    if (!entityMap) {
      entityMap = new Map();
      catMap.set(cat, entityMap);
    }
    let data = entityMap.get(entityID);
    if (!data) {
      data = createEntityData(entityID, entityName, entityClass);
      entityMap.set(entityID, data);
    }
    data.totalDispels++;
    const spell = data.bySpell.get(key);
    if (spell) {
      spell.count++;
    } else {
      data.bySpell.set(key, { spellId, name: displayName, count: 1, dispelType });
    }
  }
}

function accumulateBreakout(
  breakoutMap: Map<string, Map<string, number>>,
  entityID: string,
  spellName: string,
  dispelType: number,
) {
  let abilityMap = breakoutMap.get(entityID);
  if (!abilityMap) {
    abilityMap = new Map();
    breakoutMap.set(entityID, abilityMap);
  }
  const key = spellName || `Spell ${dispelType}`;
  abilityMap.set(key, (abilityMap.get(key) || 0) + 1);
}

// ============================================================================
// Processor
// ============================================================================

export const dispelProcessor: PanelProcessor<DispelResult, DispelProcessorEvent> = {
  id: "dispels_done",
  streams: ["dispel"],

  createState: (): DispelResult => ({
    byCaster: new Map(),
    byTarget: new Map(),
    casterByAbility: new Map(),
    targetByAbility: new Map(),
    DispelEvents: [],
  }),

  processEvent: (
    state: DispelResult,
    event: DispelProcessorEvent,
    encounterID: string,
    _firstTimestamp: Date,
    _streamType: string,
    context: ProcessorContext,
  ) => {
    if (!event.caster || !event.target) return;

    const category = toCategory(event.dispelType);
    const spellName = event.spellName || "Unknown";

    const grouping = extractGroupingFromPanelOption(context.panelOption);
    const pets = extractPetModeFromPanelOption(context.panelOption);

    // Resolve caster via resolveEntity (handles totem → shaman owner attribution)
    const casterEntity = resolveEntity(event.caster, context, grouping, pets);
    const casterName = casterEntity.name;
    const casterClass = casterEntity.class;

    // Resolve target via resolveEntity
    const targetEntity = resolveEntity(event.target, context, grouping, pets);
    const targetName = targetEntity.name;
    const targetClass = targetEntity.class;

    // Accumulate caster perspective (using resolved owner ID, e.g. shaman not totem)
    const casterCatMap = getOrCreateCategoryMap(state.byCaster, encounterID);
    accumulateEntity(casterCatMap, category, casterEntity.id, casterName, casterClass, event.spellId, spellName, event.dispelType);

    // Accumulate target perspective
    const targetCatMap = getOrCreateCategoryMap(state.byTarget, encounterID);
    accumulateEntity(targetCatMap, category, targetEntity.id, targetName, targetClass, event.spellId, spellName, event.dispelType);

    // Breakout for selected encounters
    if (context.selectedEncounterIds.has(encounterID)) {
      accumulateBreakout(state.casterByAbility, casterEntity.id, spellName, event.dispelType);
      accumulateBreakout(state.targetByAbility, targetEntity.id, spellName, event.dispelType);
    }

    // Chronological log entry
    state.DispelEvents.push({
      dateMilli: _firstTimestamp.getTime() + event.offsetMilli,
      offsetMilli: event.offsetMilli,
      encounterID,
      casterID: casterEntity.id,
      casterName,
      casterClass,
      targetID: targetEntity.id,
      targetName,
      targetClass,
      spellId: event.spellId,
      spellName,
      dispelType: event.dispelType,
      category,
    });
  },
};
