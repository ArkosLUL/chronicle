/**
 * Damage Done processor - aggregates damage by caster (pure TS, worker-safe)
 */

import type { DamageProcessorEvent, PanelProcessor, ProcessorContext } from "../processorTypes";
import { hasHitType, HitTypePeriodic } from "@/lib/hittype/hittype";
import { accumulateAbilityBreakout, type DamageAbilityBreakout } from "../processors/abilityBreakout";
import { createGuidCache, getCachedGuid, isPlayerGuidFast, type GuidCache } from "../processors/guidCache";

// Re-export the shared type for backwards compatibility
export type { DamageAbilityBreakout } from "../processors/abilityBreakout";

/**
 * Entity source types for damage aggregation
 */
export type DamageSourceType = "players" | "enemies" | "pets" | "friendly_fire";

/**
 * Player metric data for damage done aggregation.
 * Serializable - no functions or circular refs.
 */
export interface DamageDoneData {
  playerID: string;
  playerName: string;
  className: string;
  specialization: string;
  target: Map<string, number>; // target guid -> damage done
}

// UnitDamage is unit guid -> DamageDoneData
export type UnitDamage = Map<string, DamageDoneData>;

export type DamageDoneResult = {
  EncounterDamage: Map<string, UnitDamage>;
  // Value is unitID -> abilityID -> DamageAbilityBreakout
  ByAbility: Map<string, Map<string, DamageAbilityBreakout>>;
  ByTarget: Map<string, Map<string, number>>;
  // GUID cache for performance (avoids repeated parsing)
  GuidCache: GuidCache;
}

/**
 * Create a damage done processor for a specific entity source type.
 */
export function createDamageDoneProcessor(
  sourceType: DamageSourceType
): PanelProcessor<DamageDoneResult, DamageProcessorEvent> {
  const id = sourceType === "players" ? "damage_done" : `damage_done_${sourceType}`;
  
  return {
    id,
    streams: ["damage"],

    createState: () => ({
      EncounterDamage: new Map<string, UnitDamage>(),
      ByAbility: new Map<string, Map<string, DamageAbilityBreakout>>(),
      ByTarget: new Map<string, Map<string, number>>(),
      GuidCache: createGuidCache(),
    }),

    processEvent: (
      state: DamageDoneResult,
      event: DamageProcessorEvent,
      encounterID: string,
      _: Date,
      _streamType: string,
      context: ProcessorContext
    ) => {
      // Only damage events reach here (enforced by type)
      if (!event.caster) return;

      const guidCache = state.GuidCache;
      
      // Use fast player check first, fall back to cached GUID parsing
      const isPlayer = isPlayerGuidFast(event.caster) || getCachedGuid(guidCache, event.caster).isPlayer();
      const casterInfo = context.units?.[event.caster];
      // For pet check: owner must exist and be a player
      const isPet = !isPlayer && casterInfo?.owner && 
        (isPlayerGuidFast(casterInfo.owner) || getCachedGuid(guidCache, casterInfo.owner).isPlayer());
      const isEnemy = !isPlayer && !isPet;

      // Check if target is a player or player pet (for friendly fire detection)
      const targetIsPlayer = isPlayerGuidFast(event.target) || getCachedGuid(guidCache, event.target).isPlayer();
      const targetInfo = context.units?.[event.target];
      const targetIsPet = !targetIsPlayer && targetInfo?.owner &&
        (isPlayerGuidFast(targetInfo.owner) || getCachedGuid(guidCache, targetInfo.owner).isPlayer());
      const isFriendlyFire = targetIsPlayer || targetIsPet;

      // Filter by source type
      // Pet damage counts for players too!
      if (sourceType === "players" && (!isPlayer && !isPet)) return;
      if (sourceType === "pets" && !isPet) return;
      if (sourceType === "enemies" && !isEnemy) return;
      if (sourceType === "friendly_fire" && (!isPlayer && !isPet)) return;
      
      // For players/pets source, exclude friendly fire (damage to players/pets)
      // For friendly_fire source, only include friendly fire
      if (sourceType === "players" && isFriendlyFire) return;
      if (sourceType === "pets" && isFriendlyFire) return;
      if (sourceType === "friendly_fire" && !isFriendlyFire) return;

      // Determine the entity to attribute damage to
      let damageOwner = event.caster;
      if((sourceType === "players" || sourceType == "pets" || sourceType === "friendly_fire") && isPet) {
        damageOwner = casterInfo!.owner!;
      } 

      // By default, use the raw GUID as name
      let ownerName = damageOwner;
      let ownerClass = "UNKNOWN";


      if (sourceType === "players" || sourceType === "friendly_fire") {
        ownerName = context.players[damageOwner]?.name || ownerName;
        ownerClass = context.players[damageOwner]?.class || "UNKNOWN";
      } else if (sourceType === "pets") {
        // For pets, use the owner's name and the owner's class
        ownerName = (casterInfo?.owner && context.players[casterInfo?.owner]?.name) || ownerName;
        ownerName += "'s Companions";
        ownerClass = context.players[casterInfo!.owner!]?.class || "UNKNOWN";
      } else {
        // For enemies, use the unit's name
        ownerName = casterInfo?.name || ownerName;
        ownerClass = "ENEMY";
      }

      if (!state.EncounterDamage.has(encounterID)) {
        state.EncounterDamage.set(encounterID, new Map<string, DamageDoneData>());
      }
      const encounterDamage = state.EncounterDamage.get(encounterID)!;
      const existing = encounterDamage.get(damageOwner) || {
        playerID: damageOwner,
        value: 0,
        playerName: ownerName,
        className: ownerClass,
        specialization: "",
        target: new Map<string, number>(),
      } as DamageDoneData;

      // Cached static info
      existing.target.set(event.target, (existing.target.get(event.target) || 0) + event.amount);
      encounterDamage.set(damageOwner, existing);
      state.EncounterDamage.set(encounterID, encounterDamage);
      
      // Breakouts
      if(context.selectedEncounterIds.has(encounterID) &&
        (
          (sourceType === "enemies" && (context.entitySelection.playerIds.size == 0 || context.entitySelection.playerIds.has(event.target))) ||
          ((sourceType === "players" || sourceType === "pets") && (context.entitySelection.enemyIds.size == 0 || context.entitySelection.enemyIds.has(event.target))) ||
          // Friendly fire: filter by player selection (target is always a player/pet)
          (sourceType === "friendly_fire" && (context.entitySelection.playerIds.size == 0 || context.entitySelection.playerIds.has(event.target)))
        )
      ) {
        let abilityName = event.sourceName || "Auto Attack"
        if((sourceType === "players" || sourceType === "friendly_fire") && isPet) {
          const petName = context.units?.[event.caster]?.name || event.caster.toString();
          abilityName =  `${petName} (Pet)`
        } 
        if (hasHitType(event.hitType, HitTypePeriodic)) {
          abilityName = abilityName + " (DoT)";
        }

        accumulateAbilityBreakout(state.ByAbility, damageOwner, abilityName, event.amount, event.hitType);

        const existingTargetBreakout = state.ByTarget.get(damageOwner) || new Map<string, number>();
        existingTargetBreakout.set(event.target, (existingTargetBreakout.get(event.target) || 0) + event.amount);
        state.ByTarget.set(damageOwner, existingTargetBreakout);
      }
    },
  };
}

// Pre-created processors for registry
export const damageDoneProcessor = createDamageDoneProcessor("players");
export const enemyDamageDoneProcessor = createDamageDoneProcessor("enemies");
export const petDamageDoneProcessor = createDamageDoneProcessor("pets");
export const friendlyFireProcessor = createDamageDoneProcessor("friendly_fire");
