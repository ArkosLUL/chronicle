/**
 * Extra Attacks processor - aggregates extra attack procs by caster (pure TS, worker-safe)
 * 
 * Tracks abilities like Windfury, Sword Specialization, Hand of Justice, etc.
 */

import { GUID } from "@/lib/guid/guid";
import type { ExtraAttackProcessorEvent, PanelProcessor, ProcessorContext } from "../processorTypes";

/**
 * Data for a single extra attack ability
 */
export interface ExtraAttackAbility {
  name: string;
  count: number;
}

/**
 * Player data for extra attacks aggregation.
 */
export interface ExtraAttacksData {
  playerID: string;
  playerName: string;
  className: string;
  totalProcs: number;
  abilities: Map<string, ExtraAttackAbility>; // ability name -> data
  targets: Map<string, number>; // target guid -> proc count
}

// UnitExtraAttacks is unit guid -> ExtraAttacksData
export type UnitExtraAttacks = Map<string, ExtraAttacksData>;

export type ExtraAttacksResult = {
  EncounterExtraAttacks: Map<string, UnitExtraAttacks>;
  // Breakout by ability: unitID -> abilityName -> count
  ByAbility: Map<string, Map<string, number>>;
  // Breakout by target: unitID -> targetID -> count
  ByTarget: Map<string, Map<string, number>>;
}

/**
 * Create an extra attacks processor.
 */
export function createExtraAttacksProcessor(): PanelProcessor<ExtraAttacksResult, ExtraAttackProcessorEvent> {
  return {
    id: "extra_attacks",
    streams: ["extra_attack"],

    createState: () => ({
      EncounterExtraAttacks: new Map<string, UnitExtraAttacks>(),
      ByAbility: new Map<string, Map<string, number>>(),
      ByTarget: new Map<string, Map<string, number>>(),
    }),

    processEvent: (
      state: ExtraAttacksResult,
      event: ExtraAttackProcessorEvent,
      encounterID: string,
      _streamType: string,
      context: ProcessorContext
    ) => {
      // Only extra_attack events reach here (enforced by type)
      if (!event.caster) return;

      const casterGuid = GUID.fromString(event.caster);
      const isPlayer = casterGuid.isPlayer();

      // For now, only track player extra attacks
      if (!isPlayer) return;

      const playerID = event.caster;
      const playerName = context.players[playerID]?.name || playerID;
      const playerClass = context.players[playerID]?.class || "UNKNOWN";
      const abilityName = event.sourceName || "Unknown";

      // Initialize encounter map if needed
      if (!state.EncounterExtraAttacks.has(encounterID)) {
        state.EncounterExtraAttacks.set(encounterID, new Map<string, ExtraAttacksData>());
      }

      const encounterData = state.EncounterExtraAttacks.get(encounterID)!;
      const existing = encounterData.get(playerID) || {
        playerID,
        playerName,
        className: playerClass,
        totalProcs: 0,
        abilities: new Map<string, ExtraAttackAbility>(),
        targets: new Map<string, number>(),
      };

      // Update totals
      existing.totalProcs++;
      
      // Update ability breakdown
      const abilityData = existing.abilities.get(abilityName) || { name: abilityName, count: 0 };
      abilityData.count++;
      existing.abilities.set(abilityName, abilityData);

      // Update target breakdown
      existing.targets.set(event.target, (existing.targets.get(event.target) || 0) + 1);

      encounterData.set(playerID, existing);

      // Breakouts for selected encounters
      if (context.selectedEncounterIds.has(encounterID)) {
        // By ability
        const abilityBreakout = state.ByAbility.get(playerID) || new Map<string, number>();
        abilityBreakout.set(abilityName, (abilityBreakout.get(abilityName) || 0) + 1);
        state.ByAbility.set(playerID, abilityBreakout);

        // By target
        const targetBreakout = state.ByTarget.get(playerID) || new Map<string, number>();
        targetBreakout.set(event.target, (targetBreakout.get(event.target) || 0) + 1);
        state.ByTarget.set(playerID, targetBreakout);
      }
    },
  };
}

// Pre-created processor for registry
export const extraAttacksProcessor = createExtraAttacksProcessor();
