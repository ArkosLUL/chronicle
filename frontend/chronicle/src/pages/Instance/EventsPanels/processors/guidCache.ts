/**
 * GUID caching utilities for processor optimization.
 * 
 * GUID.fromString() is expensive (regex validation, BigInt parsing, object allocation).
 * For a typical raid with ~25 players + ~50 NPCs, caching reduces parsing from
 * millions of times to ~75 times.
 */

import { GUID } from "@/lib/guid/guid";

export type GuidCache = Map<string, GUID>;

/**
 * Create a new GUID cache.
 */
export function createGuidCache(): GuidCache {
  return new Map<string, GUID>();
}

/**
 * Get a GUID from cache, parsing and caching if not present.
 */
export function getCachedGuid(cache: GuidCache, guidStr: string): GUID {
  let cached = cache.get(guidStr);
  if (!cached) {
    cached = GUID.fromString(guidStr);
    cache.set(guidStr, cached);
  }
  return cached;
}

/**
 * Quick check if a GUID string represents a player without full parsing.
 * Players have high bits = 0x0000, so they start with "0x0000".
 * This avoids BigInt parsing for the common case of filtering non-players.
 */
export function isPlayerGuidFast(guidStr: string): boolean {
  // Player GUIDs: high 16 bits have form 0x00X0 where X & 0xF0 == 0x00
  // They start with "0x0000" for the simplest check
  return guidStr.startsWith("0x0000");
}
