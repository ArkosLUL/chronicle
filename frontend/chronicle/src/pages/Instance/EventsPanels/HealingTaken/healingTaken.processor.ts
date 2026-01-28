/**
 * Healing Taken processor - aggregates healing received by target (pure TS, worker-safe)
 * 
 * Similar to HealingDone processor but aggregates by healing target instead of caster.
 * Useful for identifying who is receiving the most healing (tanks, players taking damage).
 */

import type { HealProcessorEvent, PanelProcessor, ProcessorContext, ResourceChangeProcessorEvent } from "../processorTypes";
import { hasHitType, HitTypePeriodic } from "@/lib/hittype/hittype";
import { accumulateAbilityBreakout, type DamageAbilityBreakout } from "../processors/abilityBreakout";
import { isResourceChangeEvent } from "../processors/events";
import { isPlayerGuidFast } from "../processors/guidCache";

// Re-export the shared type (works for healing too)
export type { DamageAbilityBreakout as HealingAbilityBreakout } from "../processors/abilityBreakout";

/**
 * Entity target types for healing taken aggregation
 */
export type HealingTargetType = "players";

/**
 * Player metric data for healing taken aggregation.
 * Serializable - no functions or circular refs.
 */
export interface HealingTakenData {
  playerID: string;
  playerName: string;
  className: string;
  specialization: string;
  source: Map<string, number>; // source guid -> healing received
}

// UnitHealing is unit guid -> HealingTakenData
export type UnitHealingTaken = Map<string, HealingTakenData>;

export type HealingTakenResult = {
  EncounterHealing: Map<string, UnitHealingTaken>;
  // Value is targetID -> abilityName -> AbilityBreakout
  ByAbility: Map<string, Map<string, DamageAbilityBreakout>>;
  // Value is targetID -> sourceID -> amount
  BySource: Map<string, Map<string, number>>;
}

/**
 * Create a healing taken processor for a specific entity target type.
 */
export function createHealingTakenProcessor(
  targetType: HealingTargetType
): PanelProcessor<HealingTakenResult, HealProcessorEvent | ResourceChangeProcessorEvent> {
  const id = targetType === "players" ? "healing_taken" : `healing_taken_${targetType}`;
  
  return {
    id,
    streams: ["heal", "resource_change"],

    createState: () => ({
      EncounterHealing: new Map<string, UnitHealingTaken>(),
      ByAbility: new Map<string, Map<string, DamageAbilityBreakout>>(),
      BySource: new Map<string, Map<string, number>>(),
    }),

    processEvent: (
      state: HealingTakenResult,
      event: HealProcessorEvent | ResourceChangeProcessorEvent,
      encounterID: string,
      _: Date,
      streamType: string,
      context: ProcessorContext
    ) => {
      // Filter resource changes to only Health gains
      if (isResourceChangeEvent(event, streamType) && (event.resourceType !== "Health" || event.direction !== "Gain")) {
        return;
      }

      // Only process heal events
      if (!(streamType == "heal" || streamType == "resource_change")) return;
      if (!event.target) return;

      // Fast path: only track player healing received
      if (targetType === "players" && !isPlayerGuidFast(event.target)) return;

      const healingTarget = event.target;

      // Get player info for target
      let targetName = healingTarget;
      let targetClass = "UNKNOWN";

      if (targetType === "players") {
        targetName = context.players[healingTarget]?.name || targetName;
        targetClass = context.players[healingTarget]?.class || "UNKNOWN";
      }

      if (!state.EncounterHealing.has(encounterID)) {
        state.EncounterHealing.set(encounterID, new Map<string, HealingTakenData>());
      }

      const encounterHealing = state.EncounterHealing.get(encounterID)!;
      const existingEncounter = encounterHealing.get(healingTarget) || {
        playerID: healingTarget,
        playerName: targetName,
        className: targetClass,
        specialization: "",
        source: new Map<string, number>(),
      } as HealingTakenData;

      // Track healing by source (who healed this target)
      const sourceKey = event.caster || "Unknown";
      existingEncounter.source.set(sourceKey, (existingEncounter.source.get(sourceKey) || 0) + event.amount);
      encounterHealing.set(healingTarget, existingEncounter);
      state.EncounterHealing.set(encounterID, encounterHealing);
      
      // Breakouts - filter by selected players (target selection)
      if(context.selectedEncounterIds.has(encounterID) &&
        // Only show healing taken by selected players
        (context.entitySelection.playerIds.size == 0 || context.entitySelection.playerIds.has(event.target))
      ) {

        let abilityName = event.sourceName || "???";
        const hitType = isResourceChangeEvent(event, streamType) ? HitTypePeriodic : event.hitType;
        if (hasHitType(hitType, HitTypePeriodic)) {
          abilityName = abilityName + " (HoT)";
        }
      

        accumulateAbilityBreakout(state.ByAbility, healingTarget, abilityName, event.amount, hitType);

        const existingSourceBreakout = state.BySource.get(healingTarget) || new Map<string, number>();
        existingSourceBreakout.set(sourceKey, (existingSourceBreakout.get(sourceKey) || 0) + event.amount);
        state.BySource.set(healingTarget, existingSourceBreakout);
      }
    },
  };
}

// Pre-created processors for registry
export const healingTakenProcessor = createHealingTakenProcessor("players");
