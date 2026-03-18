/**
 * Rotations processor - tracks spell cast timelines per entity (pure TS, worker-safe).
 *
 * Uses spell_go (completed casts) as the primary stream, with spell_start for
 * cast-bar duration and spell_fail for failed casts.
 *
 * Default view: all casts on one row per entity.
 * Focus view (single entity selected): one row per spell ability.
 */

import type {
  PanelProcessor,
  ProcessorContext,
  DamageProcessorEvent,
  SpellGoProcessorEvent,
  SpellStartProcessorEvent,
  SpellFailProcessorEvent,
} from "../processorTypes";
import type { StreamType } from "@/hooks/instanceEvents";
import { createGuidCache, type GuidCache } from "../processors/guidCache";

// ── Result types ──────────────────────────────────────────────

export interface CastEntry {
  offsetMilli: number;
  spellId: number;
  spellName: string;
  target: string;
  eventType: "spell_go" | "spell_start" | "spell_fail" | "auto_attack";
  /** Cast time in ms (spell_start only) */
  castTimeMilli?: number;
  /** Channel time in ms (spell_start only) */
  channelTimeMilli?: number;
}

export interface RotationsResult {
  /** sourceGuid → CastEntry[] (time-ordered within each entity) */
  castsByEntity: Map<string, CastEntry[]>;
  /** spellId → spell name */
  spellNames: Map<number, string>;
  /** GUID resolution cache */
  GuidCache: GuidCache;
}

// ── Processor ─────────────────────────────────────────────────

/** Sentinel spell ID for auto attacks (swing damage with no spellId). */
export const AUTO_ATTACK_SPELL_ID = -1;

type RotationsEvent = SpellGoProcessorEvent | SpellStartProcessorEvent | SpellFailProcessorEvent | DamageProcessorEvent;

export const rotationsProcessor: PanelProcessor<RotationsResult, RotationsEvent> = {
  id: "rotations",
  streams: ["spell_go", "spell_start", "spell_fail", "damage"] as StreamType[],

  createState: (): RotationsResult => ({
    castsByEntity: new Map(),
    spellNames: new Map(),
    GuidCache: createGuidCache(),
  }),

  processEvent(
    state: RotationsResult,
    event: RotationsEvent,
    encounterID: string,
    _firstTimestamp: Date,
    _streamType: StreamType,
    context: ProcessorContext,
  ): void {
    if (!encounterID) return;
    if (!context.selectedEncounterIds.has(encounterID)) return;

    const casterGuid = event.caster;
    if (!casterGuid) return;

    // Entity selection filtering
    const { playerIds, enemyIds } = context.entitySelection;
    if (playerIds.size > 0 || enemyIds.size > 0) {
      if (!playerIds.has(casterGuid) && !enemyIds.has(casterGuid)) return;
    }

    // Handle auto attacks from the damage stream
    if (event.type === "damage") {
      // Spell ID 6603 is "Auto Attack" (swing damage)
      if (event.spellId !== 6603) return;

      if (!state.spellNames.has(AUTO_ATTACK_SPELL_ID)) {
        state.spellNames.set(AUTO_ATTACK_SPELL_ID, "Auto Attack");
      }

      const entry: CastEntry = {
        offsetMilli: event.offsetMilli,
        spellId: AUTO_ATTACK_SPELL_ID,
        spellName: "Auto Attack",
        target: event.target || "",
        eventType: "auto_attack",
      };

      let list = state.castsByEntity.get(casterGuid);
      if (!list) {
        list = [];
        state.castsByEntity.set(casterGuid, list);
      }
      list.push(entry);
      return;
    }

    const spellId = event.spell.id;
    const spellName = event.spell.name;

    // Track spell name
    if (!state.spellNames.has(spellId)) {
      state.spellNames.set(spellId, spellName);
    }
    // Build cast entry
    const entry: CastEntry = {
      offsetMilli: event.offsetMilli,
      spellId,
      spellName,
      target: "",
      eventType: event.type,
    };

    if (event.type === "spell_go") {
      entry.target = event.target || "";
    } else if (event.type === "spell_start") {
      entry.target = event.target || "";
      entry.castTimeMilli = event.castTimeMilli;
      entry.channelTimeMilli = event.channelTimeMilli;
    }

    // Append to entity's list
    let list = state.castsByEntity.get(casterGuid);
    if (!list) {
      list = [];
      state.castsByEntity.set(casterGuid, list);
    }
    list.push(entry);
  },
};
