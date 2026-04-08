/**
 * Temporal unit ownership state for processors.
 *
 * Ingests unit_classification events in timestamp order and tracks
 * possession/charm so that resolveEntity and filter predicates see the
 * correct owner at any point during event processing.
 *
 * Also centralises the GuidCache and isPlayer cache so every processor
 * and filter shares one set of lookups.
 *
 * Pure TypeScript, worker-safe. No React.
 */

import {
  type GuidCache,
  createGuidCache,
  getCachedGuid,
  isPlayerGuidFast,
} from "./guidCache";
import type {
  ProcessorUnit,
  UnitClassificationProcessorEvent,
} from "../processorTypes";

export class UnitState {
  private guidCache: GuidCache;
  /** Static unit data from server */
  private units: Record<string, ProcessorUnit>;
  /** Temporal controller overrides: target GUID → controller GUID + spell */
  private controllers: Map<string, { controller: string; spellId: number }>;
  /** Cache: GUID → isPlayer result */
  private playerCache: Map<string, boolean>;

  constructor(units: Record<string, ProcessorUnit>) {
    this.guidCache = createGuidCache();
    this.units = units;
    this.controllers = new Map();
    this.playerCache = new Map();
  }

  /** Feed a unit_classification event to update temporal state. */
  processClassification(event: UnitClassificationProcessorEvent): void {
    if (event.controller) {
      this.controllers.set(event.target, {
        controller: event.controller,
        spellId: event.spellId,
      });
    } else {
      this.controllers.delete(event.target);
    }
  }

  /**
   * Get the effective owner for a GUID.
   * Temporal controller takes priority over static owner.
   */
  getOwner(guid: string): string | null {
    const temporal = this.controllers.get(guid);
    if (temporal) return temporal.controller;
    return this.units[guid]?.owner ?? null;
  }

  /** Check if a GUID is a player (cached). */
  isPlayer(guid: string): boolean {
    let cached = this.playerCache.get(guid);
    if (cached === undefined) {
      cached = isPlayerGuidFast(guid);
      this.playerCache.set(guid, cached);
    }
    return cached;
  }

  /** Check if a GUID currently acts as a "pet" (has any owner — static or temporal). */
  isPet(guid: string): boolean {
    return this.getOwner(guid) !== null;
  }

  /** Check if a GUID is a friendly pet (owner is a player). */
  isPlayerPet(guid: string): boolean {
    const owner = this.getOwner(guid);
    return owner !== null && this.isPlayer(owner);
  }

  /** Get static unit info (name, entry). */
  getUnit(guid: string): ProcessorUnit | undefined {
    return this.units[guid];
  }

  /** Shared GUID parse cache (avoids expensive GUID.fromString per processor). */
  getGuidCache(): GuidCache {
    return this.guidCache;
  }

  /** Cached GUID parse helper. */
  getCachedGuid(guidStr: string) {
    return getCachedGuid(this.guidCache, guidStr);
  }
}
