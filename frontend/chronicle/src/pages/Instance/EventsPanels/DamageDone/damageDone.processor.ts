/**
 * Damage Done processor - aggregates damage by caster (pure TS, worker-safe)
 */

import { GUID } from "@/lib/guid/guid";
import type { PanelProcessor, ProcessorContext, ProcessorEvent } from "../processorTypes";

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

export interface DamageAbilityBreakout {
  Total: number;
  // The number of casts
  Count: number;
}

export type DamageDoneResult = {
  EncounterDamage: Map<string, UnitDamage>;
  // Value is unitID -> abilityID -> DamageAbilityBreakout
  ByAbility: Map<string, Map<string, DamageAbilityBreakout>>;
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
      if(context.selectedEncounterIds.has(encounterID) ) {
        let source = event.sourceName || "Auto Attack"
        if((sourceType === "players") && isPet) {
          source = source + " (Pet)";
        } 

        const existingUnitBreakout = state.ByAbility.get(damageOwner) || new Map<string, DamageAbilityBreakout>();
        const abilityBreakout = existingUnitBreakout.get(source) || {
          Total: 0,
          Count: 0,
        };
        
        abilityBreakout.Total += event.amount;
        abilityBreakout.Count += 1;
        existingUnitBreakout.set(source, abilityBreakout);
        state.ByAbility.set(damageOwner, existingUnitBreakout);
      }
    },
  };
}

// Pre-created processors for registry
export const damageDoneProcessor = createDamageDoneProcessor("players");
export const enemyDamageDoneProcessor = createDamageDoneProcessor("enemies");
export const petDamageDoneProcessor = createDamageDoneProcessor("pets");
