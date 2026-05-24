/**
 * Damage Taken processor - aggregates damage taken by target (pure TS, worker-safe)
 * 
 * Mirrors the DamageDone processor structure but tracks damage received instead of dealt.
 */

import type { DamageProcessorEvent, PanelProcessor, ProcessorContext } from "../processorTypes";
import { hasHitType, HitTypePeriodic } from "@/lib/hittype/hittype";
import { accumulateAbilityBreakout, accumulateAbilityBreakoutBySpellId, type DamageAbilityBreakout, type SpellIdAbilityBreakout } from "../processors/abilityBreakout";
import { createGuidCache, getCachedGuid, isPlayerGuidFast, type GuidCache } from "../processors/guidCache";
import { resolveEntity, extractGroupingFromPanelOption, extractPetModeFromPanelOption } from "../processors/resolveEntity";

// Re-export the shared type for backwards compatibility
export type { DamageAbilityBreakout } from "../processors/abilityBreakout";

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

export type DamageTakenResult = {
  EncounterDamage: Map<string, UnitDamageTaken>;
  // Value is unitID -> abilityID -> DamageAbilityBreakout
  ByAbility: Map<string, Map<string, DamageAbilityBreakout>>;
  // Value is unitID -> spellId -> SpellIdAbilityBreakout (for rank display)
  ByAbilityBySpellId: Map<string, Map<number, SpellIdAbilityBreakout>>;
  BySource: Map<string, Map<string, number>>;
  // GUID cache for performance (avoids repeated parsing)
  GuidCache: GuidCache;
}

/**
 * Create a damage taken processor for a specific entity target type.
 */
export function createDamageTakenProcessor(
  targetType: DamageTargetType
): PanelProcessor<DamageTakenResult, DamageProcessorEvent> {
  const id = targetType === "players" ? "damage_taken" : `damage_taken_${targetType}`;
  
  return {
    id,
    streams: ["damage"],

    createState: () => ({
      EncounterDamage: new Map<string, UnitDamageTaken>(),
      ByAbility: new Map<string, Map<string, DamageAbilityBreakout>>(),
      ByAbilityBySpellId: new Map<string, Map<number, SpellIdAbilityBreakout>>(),
      BySource: new Map<string, Map<string, number>>(),
      GuidCache: createGuidCache(),
    }),

    processEvent: (
      state: DamageTakenResult,
      event: DamageProcessorEvent,
      encounterID: string,
      _: Date,
      _streamType: string,
      context: ProcessorContext
    ) => {
      // Only damage events reach here (enforced by type)
      if (!event.target) return;
      const effectiveAmount = event.amount - (event.overkill || 0);

      const guidCache = state.GuidCache;
      
      // Use fast player check first, fall back to cached GUID parsing
      const isPlayer = isPlayerGuidFast(event.target) || getCachedGuid(guidCache, event.target).isPlayer();
      const targetInfo = context.units?.[event.target];
      // For pet check: owner must exist and be a player
      const isPet = !isPlayer && targetInfo?.owner && 
        (isPlayerGuidFast(targetInfo.owner) || getCachedGuid(guidCache, targetInfo.owner).isPlayer());
      const isEnemy = !isPlayer && !isPet;

      // Filter by target type — include pets in the players view
      if (targetType === "players" && !isPlayer && !isPet) return;
      if (targetType === "enemies" && !isEnemy) return;

      // Use resolveEntity for consistent grouping (entity grouping + pet mode)
      const grouping = extractGroupingFromPanelOption(context.panelOption, "default");
      const petMode = extractPetModeFromPanelOption(context.panelOption, "individual");
      const entity = resolveEntity(event.target, context, grouping, petMode);

      const damageReceiver = entity.id;
      const receiverName = entity.name;
      const receiverClass = entity.class;

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
      existing.source.set(event.caster, (existing.source.get(event.caster) || 0) + effectiveAmount);
      encounterDamage.set(damageReceiver, existing);
      state.EncounterDamage.set(encounterID, encounterDamage);
      
      // Breakouts - filter by entity selection
      if(context.selectedEncounterIds.has(encounterID)) {
        let abilityName = event.sourceName || "Auto Attack";
        if (hasHitType(event.hitType, HitTypePeriodic)) {
          abilityName = abilityName + " (DoT)";
        }

        accumulateAbilityBreakout(state.ByAbility, damageReceiver, abilityName, effectiveAmount, event.hitType, event.amount);

        if (event.spellId != null) {
          accumulateAbilityBreakoutBySpellId(state.ByAbilityBySpellId, damageReceiver, event.spellId, abilityName, effectiveAmount, event.hitType, event.amount);
        }

        const existingSourceBreakout = state.BySource.get(damageReceiver) || new Map<string, number>();
        existingSourceBreakout.set(event.caster, (existingSourceBreakout.get(event.caster) || 0) + effectiveAmount);
        state.BySource.set(damageReceiver, existingSourceBreakout);
      }
    },
  };
}

// Pre-created processors for registry
export const damageTakenProcessor = createDamageTakenProcessor("players");
export const enemyDamageTakenProcessor = createDamageTakenProcessor("enemies");
