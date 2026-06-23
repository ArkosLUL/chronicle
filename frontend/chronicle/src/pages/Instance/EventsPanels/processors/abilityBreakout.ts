/**
 * Shared ability breakout utilities for damage processors.
 */

import { hasHitType, HitTypeCrit, HitTypeCrushing, HitTypeDodge, HitTypeFullBlock, HitTypeFullResist, HitTypeGlancing, HitTypeHit, HitTypeImmune, HitTypeMiss, HitTypeParry, HitTypeReflect } from "@/lib/hittype/hittype";

/** Stats for a specific hit type (min/max/total for avg calculation) */
export interface HitTypeStats {
  count: number;
  total: number;
  min: number;
  max: number;
}

export function createEmptyHitTypeStats(): HitTypeStats {
  return { count: 0, total: 0, min: Infinity, max: -Infinity };
}

export function updateHitTypeStats(stats: HitTypeStats, amount: number): void {
  stats.count += 1;
  stats.total += amount;
  if (amount < stats.min) stats.min = amount;
  if (amount > stats.max) stats.max = amount;
}

export interface DamageAbilityBreakout {
  Total: number;
  Count: number;
  Crits: number;
  Hits: number;
  Misses: number;

  // These outcomes are not guaranteed to be present in every ability
  Dodges?: number;
  Parries?: number;
  FullResist?: number;
  Immunes?: number;
  FullBlocks?: number;
  Reflects?: number;
  Glancing?: number;
  Crushing?: number;
  Unknown?: number;

  // Min/max/total stats for damage-dealing hit types
  HitStats?: HitTypeStats;      // Regular hits (non-crit, non-glancing, non-crushing)
  CritStats?: HitTypeStats;     // Critical hits
  GlancingStats?: HitTypeStats; // Glancing blows
  CrushingStats?: HitTypeStats; // Crushing blows

  /** Optional spell ID — set for pet abilities in merged mode so the breakout
   *  can still show spell icons even though they're excluded from ByAbilityBySpellId. */
  spellId?: number;
}

export function createEmptyAbilityBreakout(): DamageAbilityBreakout {
  return {
    Total: 0,
    Count: 0,
    Crits: 0,
    Hits: 0,
    Misses: 0,
  };
}

export function updateAbilityBreakout(
  breakout: DamageAbilityBreakout,
  amount: number,
  hitType: number,
  _sourceName?: string,
  /** Raw hit amount for min/avg/max stats (defaults to amount). */
  rawAmount?: number,
): void {
  const hitAmount = rawAmount ?? amount;
  breakout.Total += amount;
  breakout.Count += 1;
  
  if (hasHitType(hitType, HitTypeCrit)) {
    breakout.Crits += 1;
    breakout.Hits += 1;
    // Track crit stats
    if (!breakout.CritStats) breakout.CritStats = createEmptyHitTypeStats();
    updateHitTypeStats(breakout.CritStats, hitAmount);
  } else if (hasHitType(hitType, HitTypeMiss)) {
    breakout.Misses += 1;
  } else if (hasHitType(hitType, HitTypeHit)) {
    breakout.Hits += 1;
    // Track regular hit stats
    if (!breakout.HitStats) breakout.HitStats = createEmptyHitTypeStats();
    updateHitTypeStats(breakout.HitStats, hitAmount);
  } else if (hasHitType(hitType, HitTypeFullResist)) {
    breakout.FullResist = (breakout.FullResist || 0) + 1;
  } else if (hasHitType(hitType, HitTypeDodge)) {
    breakout.Dodges = (breakout.Dodges || 0) + 1;
  } else if (hasHitType(hitType, HitTypeParry)) {
    breakout.Parries = (breakout.Parries || 0) + 1;
  } else if (hasHitType(hitType, HitTypeImmune)) {
    breakout.Immunes = (breakout.Immunes || 0) + 1;
  } else if (hasHitType(hitType, HitTypeFullBlock)) {
    breakout.FullBlocks = (breakout.FullBlocks || 0) + 1;
  } else if (hasHitType(hitType, HitTypeGlancing)) {
    breakout.Glancing = (breakout.Glancing || 0) + 1;
    breakout.Hits += 1;
    // Track glancing stats
    if (!breakout.GlancingStats) breakout.GlancingStats = createEmptyHitTypeStats();
    updateHitTypeStats(breakout.GlancingStats, hitAmount);
  } else if (hasHitType(hitType, HitTypeReflect)) { 
    breakout.Reflects = (breakout.Reflects || 0) + 1;
  } else if (hasHitType(hitType, HitTypeCrushing)) {
    breakout.Crushing = (breakout.Crushing || 0) + 1;
    breakout.Hits += 1;
    // Track crushing stats
    if (!breakout.CrushingStats) breakout.CrushingStats = createEmptyHitTypeStats();
    updateHitTypeStats(breakout.CrushingStats, hitAmount);
  } else {
    breakout.Unknown = (breakout.Unknown || 0) + 1;
    // console.log("Unknown hit type:", _sourceName, hitType);
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
  /** Raw hit amount for min/avg/max stats (defaults to amount). */
  rawAmount?: number,
): void {
  const unitBreakout = byAbilityMap.get(unitId) || new Map<string, DamageAbilityBreakout>();
  const abilityBreakout = unitBreakout.get(abilityName) || createEmptyAbilityBreakout();
  
  updateAbilityBreakout(abilityBreakout, amount, hitType, abilityName, rawAmount);
  
  unitBreakout.set(abilityName, abilityBreakout);
  byAbilityMap.set(unitId, unitBreakout);
}

/**
 * Ability breakout keyed by spell ID instead of name.
 * Stores both the breakout data and the spell name for display.
 */
export interface SpellIdAbilityBreakout extends DamageAbilityBreakout {
  /** The spell name to display (includes HoT suffix if applicable) */
  spellName: string;
}

export function createEmptySpellIdAbilityBreakout(spellName: string): SpellIdAbilityBreakout {
  return {
    ...createEmptyAbilityBreakout(),
    spellName,
  };
}

/**
 * Get or create a spell-ID-keyed ability breakout from a map, update it, and store it back.
 */
export function accumulateAbilityBreakoutBySpellId(
  byAbilityMap: Map<string, Map<number, SpellIdAbilityBreakout>>,
  unitId: string,
  spellId: number,
  spellName: string,
  amount: number,
  hitType: number,
  /** Raw hit amount for min/avg/max stats (defaults to amount). */
  rawAmount?: number,
): void {
  const unitBreakout = byAbilityMap.get(unitId) || new Map<number, SpellIdAbilityBreakout>();
  const abilityBreakout = unitBreakout.get(spellId) || createEmptySpellIdAbilityBreakout(spellName);
  
  updateAbilityBreakout(abilityBreakout, amount, hitType, spellName, rawAmount);
  
  unitBreakout.set(spellId, abilityBreakout);
  byAbilityMap.set(unitId, unitBreakout);
}
