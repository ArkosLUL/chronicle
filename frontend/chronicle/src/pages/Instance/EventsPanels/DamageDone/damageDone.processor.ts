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

export interface DamageAbilitiesBreakout { 
  [source: string]: DamageAbilityBreakout;
}

export type DamageDoneResult = {
  EncounterDamage: Map<string, UnitDamage>;
  // Value is unitID -> abilityID -> DamageAbilityBreakout
  ByAbility: Map<string, DamageAbilityBreakout>;
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
      ByAbility: new Map<string, DamageAbilityBreakout>(),
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
      const unit = context.units?.[event.caster];
      const isPet = !isPlayer && unit?.owner && GUID.fromString(unit.owner).isPlayer();
      const isEnemy = !isPlayer && !isPet;

      // Filter by source type
      // Pet damage counts for players too!
      if (sourceType === "players" && (!isPlayer && !isPet)) return;
      if (sourceType === "pets" && !isPet) return;
      if (sourceType === "enemies" && !isEnemy) return;

      // Determine the entity to attribute damage to
      let damageOwner = event.caster;
      if((sourceType === "players" || sourceType == "pets") && isPet) {
        damageOwner = unit!.owner!;
      } 

      // By default, use the raw GUID as name
      let ownerName = damageOwner;
      let ownerClass = "UNKNOWN";

      if (sourceType === "players") {
        ownerName = context.players[damageOwner]?.name || ownerName;
        ownerClass = context.players[damageOwner]?.class || "UNKNOWN";
      } else if (sourceType === "pets") {
        // For pets, use the owner's name and the owner's class
        ownerName = (unit?.owner && context.players[unit?.owner]?.name) || ownerName;
        ownerName += "'s Companions";
        ownerClass = context.players[unit!.owner!]?.class || "UNKNOWN";
      } else {
        // For enemies, use the unit's name
        ownerName = unit?.name || ownerName;
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

      existing.target.set(event.target, (existing.target.get(event.target) || 0) + event.amount);
      encounterDamage.set(damageOwner, existing);
      state.EncounterDamage.set(encounterID, encounterDamage);
    },
  };
}

// Pre-created processors for registry
export const damageDoneProcessor = createDamageDoneProcessor("players");
export const enemyDamageDoneProcessor = createDamageDoneProcessor("enemies");
export const petDamageDoneProcessor = createDamageDoneProcessor("pets");
