/**
 * Healing Done processor - aggregates healing by caster (pure TS, worker-safe)
 * 
 * Tracks effective healing vs overhealing by maintaining health deficits per unit.
 * 
 * Logic:
 * - Damage taken increases a unit's health deficit
 * - Resource change (health loss) increases deficit
 * - Heals reduce deficit (never below 0)
 * - Effective healing = min(heal amount, current deficit)
 * - Overhealing = heal amount - effective healing
 */

import type { DamageProcessorEvent, HealProcessorEvent, PanelProcessor, ProcessorContext, ResourceChangeProcessorEvent } from "../processorTypes";
import { hasHitType, HitTypePeriodic } from "@/lib/hittype/hittype";
import { accumulateAbilityBreakout, type DamageAbilityBreakout } from "../processors/abilityBreakout";
import { isResourceChangeEvent, isDamageEvent } from "../processors";
import { createGuidCache, getCachedGuid, isPlayerGuidFast, type GuidCache } from "../processors/guidCache";

// Re-export the shared type (works for healing too)
export type { DamageAbilityBreakout as HealingAbilityBreakout } from "../processors/abilityBreakout";

/**
 * Entity source types for healing aggregation
 */
export type HealingSourceType = "players";

/**
 * Healing breakdown per target for a single healer
 */
export interface HealingTargetData {
  effective: number;
  overheal: number;
  total: number;
}

/**
 * Player metric data for healing done aggregation.
 * Serializable - no functions or circular refs.
 */
export interface HealingDoneData {
  playerID: string;
  playerName: string;
  className: string;
  specialization: string;
  // target guid -> healing breakdown (effective, overheal, total)
  target: Map<string, HealingTargetData>;
  // Aggregate totals for this healer
  effectiveTotal: number;
  overhealTotal: number;
}

// UnitHealing is unit guid -> HealingDoneData
export type UnitHealing = Map<string, HealingDoneData>;

export type HealingDoneResult = {
  EncounterHealing: Map<string, UnitHealing>;
  // Health deficit tracking: encounterID -> targetGUID -> deficit (positive = damage taken)
  HealthDeficits: Map<string, Map<string, number>>;
  // Value is unitID -> abilityID -> AbilityBreakout (for effective healing)
  ByAbility: Map<string, Map<string, DamageAbilityBreakout>>;
  // Overheal by ability: unitID -> abilityID -> AbilityBreakout
  ByAbilityOverheal: Map<string, Map<string, DamageAbilityBreakout>>;
  ByTarget: Map<string, Map<string, number>>;
  // Overheal by target
  ByTargetOverheal: Map<string, Map<string, number>>;
  // GUID cache for performance (avoids repeated parsing)
  GuidCache: GuidCache;
}

/**
 * Get or create health deficit map for an encounter
 */
function getEncounterDeficits(state: HealingDoneResult, encounterID: string): Map<string, number> {
  if (!state.HealthDeficits.has(encounterID)) {
    state.HealthDeficits.set(encounterID, new Map<string, number>());
  }
  return state.HealthDeficits.get(encounterID)!;
}

/**
 * Create a healing done processor for a specific entity source type.
 */
export function createHealingDoneProcessor(
  sourceType: HealingSourceType
): PanelProcessor<HealingDoneResult, DamageProcessorEvent | HealProcessorEvent | ResourceChangeProcessorEvent> {
  const id = sourceType === "players" ? "healing_done" : `healing_done_${sourceType}`;
  
  return {
    id,
    streams: ["damage", "heal", "resource_change"],

    createState: () => ({
      EncounterHealing: new Map<string, UnitHealing>(),
      HealthDeficits: new Map<string, Map<string, number>>(),
      ByAbility: new Map<string, Map<string, DamageAbilityBreakout>>(),
      ByAbilityOverheal: new Map<string, Map<string, DamageAbilityBreakout>>(),
      ByTarget: new Map<string, Map<string, number>>(),
      ByTargetOverheal: new Map<string, Map<string, number>>(),
      GuidCache: createGuidCache(),
    }),

    processEvent: (
      state: HealingDoneResult,
      event: DamageProcessorEvent | HealProcessorEvent | ResourceChangeProcessorEvent,
      encounterID: string,
      _: Date,
      streamType: string,
      context: ProcessorContext
    ) => {
      const deficits = getEncounterDeficits(state, encounterID);
      const guidCache = state.GuidCache;
      
      // Handle damage events - increase target's health deficit
      if (isDamageEvent(event, streamType)) {
        // Fast path: only players can have health deficits tracked
        if (!isPlayerGuidFast(event.target)) return;
        
        const currentDeficit = deficits.get(event.target) || 0;
        deficits.set(event.target, currentDeficit + event.amount);
        return;
      }
      
      // Handle resource change - health loss increases deficit, health gain is like a heal
      if (isResourceChangeEvent(event, streamType)) {
        if (event.resourceType !== "Health") return;
        
        // Fast path: only track player health
        if (!isPlayerGuidFast(event.target)) return;
        
        if (event.direction === "Loss") {
          // Health loss (like Life Tap) increases deficit
          const currentDeficit = deficits.get(event.target) || 0;
          deficits.set(event.target, currentDeficit + event.amount);
          return;
        }
        
        // Health gain - treat as healing (fall through to healing logic below)
        if (event.direction !== "Gain") return;
      }

      // From here on, we're handling heal events or resource_change health gains
      if (!(streamType === "heal" || streamType === "resource_change")) return;
      if (!event.caster) return;

      // Use fast check first, only parse GUID if needed for non-obvious cases
      const isPlayer = isPlayerGuidFast(event.caster) || getCachedGuid(guidCache, event.caster).isPlayer();

      // For now, only track player healing
      if (sourceType === "players" && !isPlayer) return;

      const healingOwner = event.caster;
      const healTarget = event.target;
      const healAmount = event.amount;

      // Calculate effective healing based on target's deficit
      const currentDeficit = deficits.get(healTarget) || 0;
      const effectiveHeal = Math.min(healAmount, currentDeficit);
      const overheal = healAmount - effectiveHeal;
      
      // Update deficit (reduce by effective heal, never go below 0)
      deficits.set(healTarget, Math.max(0, currentDeficit - effectiveHeal));

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
      const existingHealer = encounterHealing.get(healingOwner) || {
        playerID: healingOwner,
        playerName: ownerName,
        className: ownerClass,
        specialization: "",
        target: new Map<string, HealingTargetData>(),
        effectiveTotal: 0,
        overhealTotal: 0,
      } as HealingDoneData;

      // Track healing by target with breakdown
      const existingTargetData = existingHealer.target.get(healTarget) || {
        effective: 0,
        overheal: 0,
        total: 0,
      };
      existingTargetData.effective += effectiveHeal;
      existingTargetData.overheal += overheal;
      existingTargetData.total += healAmount;
      existingHealer.target.set(healTarget, existingTargetData);
      
      // Update aggregate totals
      existingHealer.effectiveTotal += effectiveHeal;
      existingHealer.overhealTotal += overheal;
      
      encounterHealing.set(healingOwner, existingHealer);
      
      // Breakouts - filter by selected players (healer selection)
      if (context.selectedEncounterIds.has(encounterID) &&
        // Only show who the selected players healed
        (context.entitySelection.playerIds.size === 0 || context.entitySelection.playerIds.has(healTarget))
      ) {
        let abilityName = event.sourceName || "???";
        const hitType = isResourceChangeEvent(event, streamType) ? HitTypePeriodic : (event as HealProcessorEvent).hitType;
        if (hasHitType(hitType, HitTypePeriodic)) {
          abilityName = abilityName + " (HoT)";
        }

        // Track effective healing by ability
        if (effectiveHeal > 0) {
          accumulateAbilityBreakout(state.ByAbility, healingOwner, abilityName, effectiveHeal, hitType);
        }
        
        // Track overhealing by ability
        if (overheal > 0) {
          accumulateAbilityBreakout(state.ByAbilityOverheal, healingOwner, abilityName, overheal, hitType);
        }

        // Track by target (effective)
        const existingTargetBreakout = state.ByTarget.get(healingOwner) || new Map<string, number>();
        existingTargetBreakout.set(healTarget, (existingTargetBreakout.get(healTarget) || 0) + effectiveHeal);
        state.ByTarget.set(healingOwner, existingTargetBreakout);
        
        // Track by target (overheal)
        const existingTargetOverheal = state.ByTargetOverheal.get(healingOwner) || new Map<string, number>();
        existingTargetOverheal.set(healTarget, (existingTargetOverheal.get(healTarget) || 0) + overheal);
        state.ByTargetOverheal.set(healingOwner, existingTargetOverheal);
      }
    },
  };
}

// Pre-created processors for registry
export const healingDoneProcessor = createHealingDoneProcessor("players");
