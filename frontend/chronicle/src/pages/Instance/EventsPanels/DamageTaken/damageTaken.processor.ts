/**
 * Damage Taken processor - aggregates damage taken by target (pure TS, worker-safe)
 * 
 * Mirrors the DamageDone processor structure but tracks damage received instead of dealt.
 */

import { GUID } from "@/lib/guid/guid";
import type { PanelProcessor, ProcessorContext, ProcessorEvent } from "../processorTypes";
import { hasHitType, HitTypeCrit, HitTypeDodge, HitTypeFullBlock, HitTypeFullResist, HitTypeHit, HitTypeImmune, HitTypeMiss, HitTypeParry, HitTypePeriodic } from "@/lib/hittype/hittype";

/**
 * Entity target types for damage taken aggregation
 */
export type DamageTargetType = "players" | "enemies";

/**
 * Unit metric data for damage taken aggregation.
 * Serializable - no functions or circular refs.
 */
export interface DamageTakenData {
  unitID: string;
  unitName: string;
  className: string;
  specialization: string;
  source: Map<string, number>; // source guid -> damage taken from
}

// UnitDamageTaken is unit guid -> DamageTakenData
export type UnitDamageTaken = Map<string, DamageTakenData>;

export interface DamageAbilityBreakout {
  Total: number;
  // The number of casts
  Count: number;

  Crits: number;
  Hits: number;
  Dodges: number;
  Parrys: number;
  Misses: number;
  FullResist: number;
  Immunes: number;
  FullBlocks: number;
}

export type DamageTakenResult = {
  EncounterDamage: Map<string, UnitDamageTaken>;
  // Value is unitID -> abilityID -> DamageAbilityBreakout
  ByAbility: Map<string, Map<string, DamageAbilityBreakout>>;
  BySource: Map<string, Map<string, number>>;
}

/**
 * Create a damage taken processor for a specific entity target type.
 */
export function createDamageTakenProcessor(
  targetType: DamageTargetType
): PanelProcessor<DamageTakenResult> {
  const id = targetType === "players" ? "damage_taken" : `damage_taken_${targetType}`;
  
  return {
    id,
    streams: ["damage"],

    createState: () => ({
      EncounterDamage: new Map<string, UnitDamageTaken>(),
      ByAbility: new Map<string, Map<string, DamageAbilityBreakout>>(),
      BySource: new Map<string, Map<string, number>>(),
    }),

    processEvent: (
      state: DamageTakenResult,
      event: ProcessorEvent,
      encounterID: string,
      streamType: string,
      context: ProcessorContext
    ) => {
      // Only process damage events
      if (streamType !== "damage") return;
      if (!event.target) return;

      const targetGuid = GUID.fromString(event.target);
      const isPlayer = targetGuid.isPlayer();
      const targetInfo = context.units?.[event.target];
      const isPet = !isPlayer && targetInfo?.owner && GUID.fromString(targetInfo.owner).isPlayer();
      const isEnemy = !isPlayer && !isPet;

      // Filter by target type
      if (targetType === "players" && !isPlayer) return;
      if (targetType === "enemies" && !isEnemy) return;

      // The unit receiving damage
      const damageReceiver = event.target;

      // By default, use the raw GUID as name
      let receiverName = damageReceiver;
      let receiverClass = "UNKNOWN";

      if (targetType === "players") {
        receiverName = context.players[damageReceiver]?.name || receiverName;
        receiverClass = context.players[damageReceiver]?.class || "UNKNOWN";
      } else {
        // For enemies, use the unit's name
        receiverName = targetInfo?.name || receiverName;
        receiverClass = "ENEMY";
      }

      if (!state.EncounterDamage.has(encounterID)) {
        state.EncounterDamage.set(encounterID, new Map<string, DamageTakenData>());
      }
      const encounterDamage = state.EncounterDamage.get(encounterID)!;
      const existing = encounterDamage.get(damageReceiver) || {
        unitID: damageReceiver,
        value: 0,
        unitName: receiverName,
        className: receiverClass,
        specialization: "",
        source: new Map<string, number>(),
      } as DamageTakenData;

      // Track damage by source
      existing.source.set(event.caster, (existing.source.get(event.caster) || 0) + event.amount);
      encounterDamage.set(damageReceiver, existing);
      state.EncounterDamage.set(encounterID, encounterDamage);
      
      // Breakouts - filter by entity selection
      if(context.selectedEncounterIds.has(encounterID) &&
        (
          (targetType === "enemies" && (context.entitySelection.enemyIds.size == 0 || context.entitySelection.enemyIds.has(event.target))) ||
          (targetType === "players" && (context.entitySelection.playerIds.size == 0 || context.entitySelection.playerIds.has(event.target)))
        )
      ) {
        let source = event.sourceName || "Auto Attack";
        if (hasHitType(event.hitType, HitTypePeriodic)) {
          source = source + " (DoT)";
        }

        const existingUnitBreakout = state.ByAbility.get(damageReceiver) || new Map<string, DamageAbilityBreakout>();
        const abilityBreakout: DamageAbilityBreakout = existingUnitBreakout.get(source) || {
          Total: 0,
          Count: 0,
          Crits: 0,
          Hits: 0,
          Misses: 0,
          FullResist: 0,
          Dodges: 0,
          Parrys: 0,
          Immunes: 0,
          FullBlocks: 0,
        };
        
        abilityBreakout.Total += event.amount;
        abilityBreakout.Count += 1;
        if (hasHitType(event.hitType, HitTypeCrit)) {
          abilityBreakout.Crits += 1;
          abilityBreakout.Hits += 1;
        } else if (hasHitType(event.hitType, HitTypeMiss)) {
          abilityBreakout.Misses += 1;
        } else if (hasHitType(event.hitType, HitTypeHit) || hasHitType(event.hitType, HitTypePeriodic)) {
          abilityBreakout.Hits += 1;
        } else if (hasHitType(event.hitType, HitTypeFullResist)) {
          abilityBreakout.FullResist += 1;
        } else if (hasHitType(event.hitType, HitTypeDodge)) {
          abilityBreakout.Dodges += 1;
        } else if (hasHitType(event.hitType, HitTypeParry)) {
          abilityBreakout.Parrys += 1;
        } else if (hasHitType(event.hitType, HitTypeImmune)) {
          abilityBreakout.Immunes += 1;
        } else if (hasHitType(event.hitType, HitTypeFullBlock)) {
          abilityBreakout.FullBlocks += 1;
        } else {
          console.log("Unknown hit type for damage taken:", event.sourceName, event.hitType);
        }

        existingUnitBreakout.set(source, abilityBreakout);
        state.ByAbility.set(damageReceiver, existingUnitBreakout);

        const existingSourceBreakout = state.BySource.get(damageReceiver) || new Map<string, number>();
        existingSourceBreakout.set(event.caster, (existingSourceBreakout.get(event.caster) || 0) + event.amount);
        state.BySource.set(damageReceiver, existingSourceBreakout);
      }
    },
  };
}

// Pre-created processors for registry
export const damageTakenProcessor = createDamageTakenProcessor("players");
export const enemyDamageTakenProcessor = createDamageTakenProcessor("enemies");
