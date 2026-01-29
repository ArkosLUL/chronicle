/**
 * Unified Healing processor - aggregates healing by both caster AND target in a single pass.
 * 
 * This processor is more efficient than separate HealingDone/HealingTaken processors
 * because it only processes damage/heal/resource_change streams once, and the health
 * deficit tracking is shared.
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
import { accumulateAbilityBreakout, type DamageAbilityBreakout } from "./abilityBreakout";
import { isResourceChangeEvent, isDamageEvent } from "./events";
import { createGuidCache, getCachedGuid, isPlayerGuidFast, isPetGuidFast, type GuidCache } from "./guidCache";

// Re-export the shared type (works for healing too)
export type { DamageAbilityBreakout as HealingAbilityBreakout } from "./abilityBreakout";

/**
 * Healing breakdown per target for a single healer (HealingDone aggregation)
 */
export interface HealingTargetData {
  effective: number;
  overheal: number;
  total: number;
}

/**
 * Healer data for HealingDone aggregation.
 */
export interface HealerData {
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

/**
 * Healing source breakdown for a single target (HealingTaken aggregation)
 */
export interface HealingSourceData {
  effective: number;
  overheal: number;
  total: number;
}

/**
 * Target data for HealingTaken aggregation.
 */
export interface HealingReceiverData {
  playerID: string;
  playerName: string;
  className: string;
  specialization: string;
  // source guid -> healing breakdown (effective, overheal, total)
  source: Map<string, HealingSourceData>;
  // Aggregate totals for this receiver
  effectiveTotal: number;
  overhealTotal: number;
}

// Maps for per-encounter aggregations
export type UnitHealingDone = Map<string, HealerData>;
export type UnitHealingTaken = Map<string, HealingReceiverData>;

export type UnifiedHealingResult = {
  // === HealingDone data (by healer) ===
  EncounterHealingByHealer: Map<string, UnitHealingDone>;
  // Breakouts: healerID -> abilityName -> data
  HealerByAbility: Map<string, Map<string, DamageAbilityBreakout>>;
  HealerByAbilityOverheal: Map<string, Map<string, DamageAbilityBreakout>>;
  // Breakouts: healerID -> targetID -> amount
  HealerByTarget: Map<string, Map<string, number>>;
  HealerByTargetOverheal: Map<string, Map<string, number>>;
  
  // === HealingTaken data (by target) ===
  EncounterHealingByTarget: Map<string, UnitHealingTaken>;
  // Breakouts: targetID -> abilityName -> data  
  TargetByAbility: Map<string, Map<string, DamageAbilityBreakout>>;
  TargetByAbilityOverheal: Map<string, Map<string, DamageAbilityBreakout>>;
  // Breakouts: targetID -> sourceID -> amount
  TargetBySource: Map<string, Map<string, number>>;
  TargetBySourceOverheal: Map<string, Map<string, number>>;
  
  // === Shared state ===
  // Health deficit tracking: targetGUID -> deficit (positive = damage taken)
  // Reset to empty when encounterID changes
  HealthDeficits: Map<string, number>;
  // Track last encounter ID to detect transitions
  LastEncounterID: string | null;
  // GUID cache for performance (avoids repeated parsing)
  GuidCache: GuidCache;
}

/**
 * Get health deficit map, resetting if encounter changed.
 * This ensures each encounter starts with fresh deficit tracking.
 */
function getDeficits(state: UnifiedHealingResult, encounterID: string): Map<string, number> {
  if (state.LastEncounterID !== encounterID) {
    // New encounter - reset all deficits to 0
    state.HealthDeficits.clear();
    state.LastEncounterID = encounterID;
  }
  return state.HealthDeficits;
}

/**
 * Create the unified healing processor.
 */
export function createUnifiedHealingProcessor(): PanelProcessor<UnifiedHealingResult, DamageProcessorEvent | HealProcessorEvent | ResourceChangeProcessorEvent> {
  return {
    id: "healing",
    streams: ["damage", "heal", "resource_change"],

    createState: () => ({
      // HealingDone
      EncounterHealingByHealer: new Map(),
      HealerByAbility: new Map(),
      HealerByAbilityOverheal: new Map(),
      HealerByTarget: new Map(),
      HealerByTargetOverheal: new Map(),
      // HealingTaken
      EncounterHealingByTarget: new Map(),
      TargetByAbility: new Map(),
      TargetByAbilityOverheal: new Map(),
      TargetBySource: new Map(),
      TargetBySourceOverheal: new Map(),
      // Shared
      HealthDeficits: new Map(),
      LastEncounterID: null,
      GuidCache: createGuidCache(),
    }),

    processEvent: (
      state: UnifiedHealingResult,
      event: DamageProcessorEvent | HealProcessorEvent | ResourceChangeProcessorEvent,
      encounterID: string,
      _: Date,
      streamType: string,
      context: ProcessorContext
    ) => {
      const deficits = getDeficits(state, encounterID);
      const guidCache = state.GuidCache;
      
      // Helper to check if a target is a player or a player-owned pet.
      // Fast path: if already in deficits map, we've validated them before.
      const isPlayerOrFriendlyPet = (targetGuid: string): boolean => {
        if (deficits.has(targetGuid)) return true;
        if (isPlayerGuidFast(targetGuid)) return true;
        if (isPetGuidFast(targetGuid)) {
          // Pet must have a player owner
          const petInfo = context.units?.[targetGuid];
          if (petInfo?.owner) {
            return isPlayerGuidFast(petInfo.owner) || getCachedGuid(guidCache, petInfo.owner).isPlayer();
          }
        }
        return false;
      };
      
      // Handle damage events - increase target's health deficit
      if (isDamageEvent(event, streamType)) {
        // Only players and player-owned pets can have health deficits tracked
        if (!isPlayerOrFriendlyPet(event.target)) return;
        
        const currentDeficit = deficits.get(event.target) || 0;
        deficits.set(event.target, currentDeficit + event.amount);
        return;
      }
      
      // Handle resource change - health loss increases deficit, health gain is like a heal
      if (isResourceChangeEvent(event, streamType)) {
        if (event.resourceType !== "Health") return;
        
        // Only track player and player-owned pet health
        if (!isPlayerOrFriendlyPet(event.target)) return;
        
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

      // Caster must be a player
      const isCasterPlayer = isPlayerGuidFast(event.caster) || getCachedGuid(guidCache, event.caster).isPlayer();
      if (!isCasterPlayer) return;

      const healerID = event.caster;
      const targetID = event.target;
      const healAmount = event.amount;

      // Calculate effective healing based on target's deficit
      // For players and player-owned pets, use deficit tracking
      // For other targets (friendly NPCs, etc.), count all as overheal
      let effectiveHeal: number;
      let overheal: number;
      
      if (isPlayerOrFriendlyPet(targetID)) {
        const currentDeficit = deficits.get(targetID) || 0;
        effectiveHeal = Math.min(healAmount, currentDeficit);
        overheal = healAmount - effectiveHeal;
        // Update deficit (reduce by effective heal, never go below 0)
        deficits.set(targetID, Math.max(0, currentDeficit - effectiveHeal));
      } else {
        // Non-player, non-pet targets: count all healing as overheal
        effectiveHeal = 0;
        overheal = healAmount;
      }

      // Get player info
      const healerName = context.players[healerID]?.name || healerID;
      const healerClass = context.players[healerID]?.class || "UNKNOWN";
      
      // Determine if this is an "other" target (non-player, non-pet)
      const isOtherTarget = effectiveHeal === 0 && overheal === healAmount && !isPlayerOrFriendlyPet(targetID);
      
      // For "other" targets, use a fixed ID so they all aggregate together
      const aggregateTargetID = isOtherTarget ? "__other__" : targetID;
      
      // Get target info - format based on target type
      let targetName: string;
      let targetClass: string;
      if (isOtherTarget) {
        targetName = "Other";
        targetClass = "NPC";
      } else {
        const targetPlayerInfo = context.players[targetID];
        if (targetPlayerInfo) {
          // Player target
          targetName = targetPlayerInfo.name;
          targetClass = targetPlayerInfo.class || "UNKNOWN";
        } else {
          // Pet with owner - format as "{Owner}'s Pet {PetName}"
          const unitInfo = context.units?.[targetID];
          const ownerName = unitInfo?.owner ? (context.players[unitInfo.owner]?.name || "Unknown") : "Unknown";
          targetName = `${ownerName}'s Pet ${unitInfo?.name || "Unknown"}`;
          targetClass = unitInfo?.owner ? (context.players[unitInfo.owner]?.class || "UNKNOWN") : "UNKNOWN";
        }
      }

      // === Update HealingDone aggregation (by healer) ===
      if (!state.EncounterHealingByHealer.has(encounterID)) {
        state.EncounterHealingByHealer.set(encounterID, new Map());
      }
      const encounterByHealer = state.EncounterHealingByHealer.get(encounterID)!;
      
      let healerData = encounterByHealer.get(healerID);
      if (!healerData) {
        healerData = {
          playerID: healerID,
          playerName: healerName,
          className: healerClass,
          specialization: "",
          target: new Map(),
          effectiveTotal: 0,
          overhealTotal: 0,
        };
        encounterByHealer.set(healerID, healerData);
      }
      
      // Track healing by target
      let targetData = healerData.target.get(aggregateTargetID);
      if (!targetData) {
        targetData = { effective: 0, overheal: 0, total: 0 };
        healerData.target.set(aggregateTargetID, targetData);
      }
      targetData.effective += effectiveHeal;
      targetData.overheal += overheal;
      targetData.total += healAmount;
      
      healerData.effectiveTotal += effectiveHeal;
      healerData.overhealTotal += overheal;

      if(event.caster === "0x000000000002A882" && encounterID === "c7283a34-5473-4b8e-809b-1075d98133ba") {
        console.log(`Heal processed: encounter=${encounterID} healer=${healerName} target=${targetName} amount=${healAmount} effective=${effectiveHeal} overheal=${overheal}`);
      }

      // === Update HealingTaken aggregation (by target) ===
      if (!state.EncounterHealingByTarget.has(encounterID)) {
        state.EncounterHealingByTarget.set(encounterID, new Map());
      }
      const encounterByTarget = state.EncounterHealingByTarget.get(encounterID)!;
      
      let receiverData = encounterByTarget.get(aggregateTargetID);
      if (!receiverData) {
        receiverData = {
          playerID: aggregateTargetID,
          playerName: targetName,
          className: targetClass,
          specialization: "",
          source: new Map(),
          effectiveTotal: 0,
          overhealTotal: 0,
        };
        encounterByTarget.set(aggregateTargetID, receiverData);
      }
      
      // Track healing by source
      let sourceData = receiverData.source.get(healerID);
      if (!sourceData) {
        sourceData = { effective: 0, overheal: 0, total: 0 };
        receiverData.source.set(healerID, sourceData);
      }
      sourceData.effective += effectiveHeal;
      sourceData.overheal += overheal;
      sourceData.total += healAmount;
      
      receiverData.effectiveTotal += effectiveHeal;
      receiverData.overhealTotal += overheal;

      // === Breakouts (only for selected encounters) ===
      if (!context.selectedEncounterIds.has(encounterID)) return;
      
      // Determine ability name
      let abilityName = event.sourceName || "???";
      const hitType = isResourceChangeEvent(event, streamType) ? HitTypePeriodic : (event as HealProcessorEvent).hitType;
      if (hasHitType(hitType, HitTypePeriodic)) {
        abilityName = abilityName + " (HoT)";
      }

      // Filter for healer breakouts: only show healing to selected players (or all if none selected)
      // "Other" targets are always included in breakouts
      const includeInHealerBreakout = isOtherTarget || 
        context.entitySelection.playerIds.size === 0 || 
        context.entitySelection.playerIds.has(targetID);
      
      if (includeInHealerBreakout) {
        // Healer ability breakdown
        if (effectiveHeal > 0) {
          accumulateAbilityBreakout(state.HealerByAbility, healerID, abilityName, effectiveHeal, hitType);
        }
        if (overheal > 0) {
          accumulateAbilityBreakout(state.HealerByAbilityOverheal, healerID, abilityName, overheal, hitType);
        }

        // Healer target breakdown
        const healerTargets = state.HealerByTarget.get(healerID) || new Map();
        healerTargets.set(aggregateTargetID, (healerTargets.get(aggregateTargetID) || 0) + effectiveHeal);
        state.HealerByTarget.set(healerID, healerTargets);
        
        const healerTargetsOverheal = state.HealerByTargetOverheal.get(healerID) || new Map();
        healerTargetsOverheal.set(aggregateTargetID, (healerTargetsOverheal.get(aggregateTargetID) || 0) + overheal);
        state.HealerByTargetOverheal.set(healerID, healerTargetsOverheal);
      }

      // Filter for target breakouts: only show healing received by selected players (or all if none selected)
      // "Other" targets are always included in breakouts
      const includeInTargetBreakout = isOtherTarget ||
        context.entitySelection.playerIds.size === 0 || 
        context.entitySelection.playerIds.has(targetID);
      
      if (includeInTargetBreakout) {
        // Target ability breakdown
        if (effectiveHeal > 0) {
          accumulateAbilityBreakout(state.TargetByAbility, aggregateTargetID, abilityName, effectiveHeal, hitType);
        }
        if (overheal > 0) {
          accumulateAbilityBreakout(state.TargetByAbilityOverheal, aggregateTargetID, abilityName, overheal, hitType);
        }

        // Target source breakdown
        const targetSources = state.TargetBySource.get(aggregateTargetID) || new Map();
        targetSources.set(healerID, (targetSources.get(healerID) || 0) + effectiveHeal);
        state.TargetBySource.set(aggregateTargetID, targetSources);
        
        const targetSourcesOverheal = state.TargetBySourceOverheal.get(aggregateTargetID) || new Map();
        targetSourcesOverheal.set(healerID, (targetSourcesOverheal.get(healerID) || 0) + overheal);
        state.TargetBySourceOverheal.set(aggregateTargetID, targetSourcesOverheal);
      }
    },
  };
}

// Pre-created processor for registry
export const unifiedHealingProcessor = createUnifiedHealingProcessor();
