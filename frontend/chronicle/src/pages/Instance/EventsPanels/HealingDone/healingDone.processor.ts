/**
 * Healing Done processor - aggregates healing by caster (pure TS, worker-safe)
 * 
 * Similar to DamageDone processor but tracks healing instead.
 */

import { GUID } from "@/lib/guid/guid";
import type { HealProcessorEvent, PanelProcessor, ProcessorContext, ResourceChangeProcessorEvent } from "../processorTypes";
import { hasHitType, HitTypePeriodic } from "@/lib/hittype/hittype";
import { accumulateAbilityBreakout, type DamageAbilityBreakout } from "../processors/abilityBreakout";
import { isResourceChangeEvent } from "../processors";

// Re-export the shared type (works for healing too)
export type { DamageAbilityBreakout as HealingAbilityBreakout } from "../processors/abilityBreakout";

/**
 * Entity source types for healing aggregation
 */
export type HealingSourceType = "players";

/**
 * Player metric data for healing done aggregation.
 * Serializable - no functions or circular refs.
 */
export interface HealingDoneData {
  playerID: string;
  playerName: string;
  className: string;
  specialization: string;
  target: Map<string, number>; // target guid -> healing done
}

// UnitHealing is unit guid -> HealingDoneData
export type UnitHealing = Map<string, HealingDoneData>;

export type HealingDoneResult = {
  EncounterHealing: Map<string, UnitHealing>;
  // Value is unitID -> abilityID -> AbilityBreakout
  ByAbility: Map<string, Map<string, DamageAbilityBreakout>>;
  ByTarget: Map<string, Map<string, number>>;
}

/**
 * Create a healing done processor for a specific entity source type.
 */
export function createHealingDoneProcessor(
  sourceType: HealingSourceType
): PanelProcessor<HealingDoneResult, HealProcessorEvent | ResourceChangeProcessorEvent> {
  const id = sourceType === "players" ? "healing_done" : `healing_done_${sourceType}`;
  
  return {
    id,
    streams: ["heal", "resource_change"],

    createState: () => ({
      EncounterHealing: new Map<string, UnitHealing>(),
      ByAbility: new Map<string, Map<string, DamageAbilityBreakout>>(),
      ByTarget: new Map<string, Map<string, number>>(),
    }),

    processEvent: (
      state: HealingDoneResult,
      event: HealProcessorEvent | ResourceChangeProcessorEvent,
      encounterID: string,
      streamType: string,
      context: ProcessorContext
    ) => {
      if (isResourceChangeEvent(event, streamType) && (event.resourceType !== "Health" || event.direction !== "Gain")) {
        return;
      }

      // Only process heal events
      if (!(streamType == "heal" || streamType == "resource_change")) return;
      if (!event.caster) return;

      const casterGuid = GUID.fromString(event.caster);
      const isPlayer = casterGuid.isPlayer();

      // For now, only track player healing
      if (sourceType === "players" && !isPlayer) return;

      const healingOwner = event.caster;

      // Get player info
      let ownerName = healingOwner;
      let ownerClass = "UNKNOWN";

      if (sourceType === "players") {
        ownerName = context.players[healingOwner]?.name || ownerName;
        ownerClass = context.players[healingOwner]?.class || "UNKNOWN";
      }

      if (!state.EncounterHealing.has(encounterID)) {
        state.EncounterHealing.set(encounterID, new Map<string, HealingDoneData>());
      }

      const encounterHealing = state.EncounterHealing.get(encounterID)!;
      const existingEncounter = encounterHealing.get(healingOwner) || {
        playerID: healingOwner,
        playerName: ownerName,
        className: ownerClass,
        specialization: "",
        target: new Map<string, number>(),
      } as HealingDoneData;

      // Track healing by target
      existingEncounter.target.set(event.target, (existingEncounter.target.get(event.target) || 0) + event.amount);
      encounterHealing.set(healingOwner, existingEncounter);
      state.EncounterHealing.set(encounterID, encounterHealing);
      
      // Breakouts - filter by selected players (healer selection)
      if(context.selectedEncounterIds.has(encounterID) &&
        // Only show who the selected players healed
        (context.entitySelection.playerIds.size == 0 || context.entitySelection.playerIds.has(event.target))
      ) {

        let abilityName = event.sourceName || "???";
        const hitType = isResourceChangeEvent(event, streamType) ? HitTypePeriodic : event.hitType;
        if (hasHitType(hitType, HitTypePeriodic)) {
          abilityName = abilityName + " (HoT)";
        }
      

        accumulateAbilityBreakout(state.ByAbility, healingOwner, abilityName, event.amount, hitType);

        const existingTargetBreakout = state.ByTarget.get(healingOwner) || new Map<string, number>();
        existingTargetBreakout.set(event.target, (existingTargetBreakout.get(event.target) || 0) + event.amount);
        state.ByTarget.set(healingOwner, existingTargetBreakout);
      }
    },
  };
}

// Pre-created processors for registry
export const healingDoneProcessor = createHealingDoneProcessor("players");
