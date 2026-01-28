/**
 * Damage Done processor - aggregates damage by caster (pure TS, worker-safe)
 */

import { GUID } from "@/lib/guid/guid";
import type { PanelProcessor, ProcessorContext, ProcessorEvent } from "../processorTypes";
import { hasHitType, HitTypePeriodic } from "@/lib/hittype/hittype";
import { accumulateAbilityBreakout, type DamageAbilityBreakout } from "../processors/abilityBreakout";

// Re-export the shared type for backwards compatibility
export type { DamageAbilityBreakout } from "../processors/abilityBreakout";

/**
 * Entity source types for damage aggregation
 */
export type DamageSourceType = "players" | "enemies" | "pets";

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
}

/**
 * Create a damage done processor for a specific entity source type.
 */
export function createDamageDoneProcessor(
  sourceType: DamageSourceType
): PanelProcessor<DamageDoneResult> {
  const id = sourceType === "players" ? "damage_done" : `damage_done_${sourceType}`;
  
  return {
    id,
    streams: ["damage"],

    createState: () => ({
      EncounterDamage: new Map<string, UnitDamage>(),
      ByAbility: new Map<string, Map<string, DamageAbilityBreakout>>(),
      ByTarget: new Map<string, Map<string, number>>(),
    }),

    processEvent: (
      state: DamageDoneResult,
      event: ProcessorEvent,
      encounterID: string,
      streamType: string,
      context: ProcessorContext
    ) => {
      // Only process damage events
      if (streamType !== "damage") return;
      if (!event.caster) return;

      const casterGuid = GUID.fromString(event.caster);
      const isPlayer = casterGuid.isPlayer();
      const casterInfo = context.units?.[event.caster];
      const isPet = !isPlayer && casterInfo?.owner && GUID.fromString(casterInfo.owner).isPlayer();
      const isEnemy = !isPlayer && !isPet;

      // Filter by source type
      // Pet damage counts for players too!
      if (sourceType === "players" && (!isPlayer && !isPet)) return;
      if (sourceType === "pets" && !isPet) return;
      if (sourceType === "enemies" && !isEnemy) return;

      // Determine the entity to attribute damage to
      let damageOwner = event.caster;
      if((sourceType === "players" || sourceType == "pets") && isPet) {
        damageOwner = casterInfo!.owner!;
      } 

      // By default, use the raw GUID as name
      let ownerName = damageOwner;
      let ownerClass = "UNKNOWN";


      if (sourceType === "players") {
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
          ((sourceType === "players" || sourceType === "pets") && (context.entitySelection.enemyIds.size == 0 || context.entitySelection.enemyIds.has(event.target)))
        )
      ) {
        let abilityName = event.sourceName || "Auto Attack"
        if((sourceType === "players") && isPet) {
          abilityName = abilityName + " (Pet)";
        } 
        if (hasHitType(event.hitType, HitTypePeriodic)) {
          abilityName = abilityName + " (DoT)";
        }

        accumulateAbilityBreakout(state.ByAbility, damageOwner, abilityName, event.amount, event.hitType, event.sourceName);

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
