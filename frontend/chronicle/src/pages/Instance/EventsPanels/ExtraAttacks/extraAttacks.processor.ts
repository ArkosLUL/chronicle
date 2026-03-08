/**
 * Extra Attacks processor - aggregates extra attack procs by player (pure TS, worker-safe)
 * 
 * Tracks abilities like Windfury, Sword Specialization, Hand of Justice, etc.
 * Extra attacks are granted TO the player (stored in event.target), not from them.
 */

import type { ExtraAttackProcessorEvent, PanelProcessor, ProcessorContext } from "../processorTypes";
import { resolveEntity, extractGroupingFromPanelOption, extractPetModeFromPanelOption } from "../processors/resolveEntity";

/**
 * Data for a single extra attack ability
 */
export interface ExtraAttackAbility {
  name: string;
  count: number;
  totalAttacks: number;  // Total extra attacks granted (amount can be > 1)
}

/**
 * Player data for extra attacks aggregation.
 */
export interface ExtraAttacksData {
  playerID: string;
  playerName: string;
  className: string;
  totalProcs: number;       // Number of proc events
  totalAttacks: number;     // Total extra attacks granted (sum of amounts)
  abilities: Map<string, ExtraAttackAbility>; // ability name -> data
}

// UnitExtraAttacks is unit guid -> ExtraAttacksData
export type UnitExtraAttacks = Map<string, ExtraAttacksData>;

export type ExtraAttacksResult = {
  EncounterExtraAttacks: Map<string, UnitExtraAttacks>;
  // Breakout by ability: unitID -> abilityName -> total attacks
  ByAbility: Map<string, Map<string, number>>;
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
    }),

    processEvent: (
      state: ExtraAttacksResult,
      event: ExtraAttackProcessorEvent,
      encounterID: string,
      _: Date,
      _streamType: string,
      context: ProcessorContext
    ) => {
      // event.target is the player who gained extra attacks
      if (!event.target) return;

      const grouping = extractGroupingFromPanelOption(context.panelOption);
      const pets = extractPetModeFromPanelOption(context.panelOption);
      const entity = resolveEntity(event.target, context, grouping, pets);
      const ownerID = entity.id;
      const ownerName = entity.name;
      const ownerClass = entity.class;

      // const playerClass = context.players[playerID]?.class || "UNKNOWN";
      const abilityName = event.sourceName || "Unknown";
      const attackCount = event.amount || 1;  // How many extra attacks this proc granted

      // Initialize encounter map if needed
      if (!state.EncounterExtraAttacks.has(encounterID)) {
        state.EncounterExtraAttacks.set(encounterID, new Map<string, ExtraAttacksData>());
      }

      const encounterData = state.EncounterExtraAttacks.get(encounterID)!;
      const existing = encounterData.get(ownerID) || {
        playerID: ownerID,
        playerName: ownerName,
        className: ownerClass,
        totalProcs: 0,
        totalAttacks: 0,
        abilities: new Map<string, ExtraAttackAbility>(),
      };

      // Update totals
      existing.totalProcs++;
      existing.totalAttacks += attackCount;
      
      // Update ability breakdown
      const abilityData = existing.abilities.get(abilityName) || { name: abilityName, count: 0, totalAttacks: 0 };
      abilityData.count++;
      abilityData.totalAttacks += attackCount;
      existing.abilities.set(abilityName, abilityData);

      encounterData.set(ownerID, existing);

      // Breakouts for selected encounters
      if (context.selectedEncounterIds.has(encounterID)) {
        // By ability - track total attacks
        const abilityBreakout = state.ByAbility.get(ownerID) || new Map<string, number>();
        abilityBreakout.set(abilityName, (abilityBreakout.get(abilityName) || 0) + attackCount);
        state.ByAbility.set(ownerID, abilityBreakout);
      }
    },
  };
}

// Pre-created processor for registry
export const extraAttacksProcessor = createExtraAttacksProcessor();
