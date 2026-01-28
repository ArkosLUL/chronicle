/**
 * Shared ability breakout utilities for damage processors.
 */

import { hasHitType, HitTypeCrit, HitTypeDodge, HitTypeFullBlock, HitTypeFullResist, HitTypeHit, HitTypeImmune, HitTypeMiss, HitTypeParry, HitTypePeriodic } from "@/lib/hittype/hittype";

export interface DamageAbilityBreakout {
  Total: number;
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

export function createEmptyAbilityBreakout(): DamageAbilityBreakout {
  return {
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
}

export function updateAbilityBreakout(
  breakout: DamageAbilityBreakout,
  amount: number,
  hitType: number,
  sourceName?: string,
): void {
  breakout.Total += amount;
  breakout.Count += 1;
  
  if (hasHitType(hitType, HitTypeCrit)) {
    breakout.Crits += 1;
    breakout.Hits += 1;
  } else if (hasHitType(hitType, HitTypeMiss)) {
    breakout.Misses += 1;
  } else if (hasHitType(hitType, HitTypeHit) || hasHitType(hitType, HitTypePeriodic)) {
    breakout.Hits += 1;
  } else if (hasHitType(hitType, HitTypeFullResist)) {
    breakout.FullResist += 1;
  } else if (hasHitType(hitType, HitTypeDodge)) {
    breakout.Dodges += 1;
  } else if (hasHitType(hitType, HitTypeParry)) {
    breakout.Parrys += 1;
  } else if (hasHitType(hitType, HitTypeImmune)) {
    breakout.Immunes += 1;
  } else if (hasHitType(hitType, HitTypeFullBlock)) {
    breakout.FullBlocks += 1;
  } else {
    console.log("Unknown hit type:", sourceName, hitType);
  }
}

/**
 * Get or create an ability breakout from a map, update it, and store it back.
 */
export function accumulateAbilityBreakout(
  byAbilityMap: Map<string, Map<string, DamageAbilityBreakout>>,
  unitId: string,
  abilityName: string,
  amount: number,
  hitType: number,
  sourceName?: string,
): void {
  const unitBreakout = byAbilityMap.get(unitId) || new Map<string, DamageAbilityBreakout>();
  const abilityBreakout = unitBreakout.get(abilityName) || createEmptyAbilityBreakout();
  
  updateAbilityBreakout(abilityBreakout, amount, hitType, sourceName);
  
  unitBreakout.set(abilityName, abilityBreakout);
  byAbilityMap.set(unitId, unitBreakout);
}
