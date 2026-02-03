/**
 * Deaths processor - aggregates player and enemy deaths from slain events (pure TS, worker-safe)
 */

import type { SlainProcessorEvent, PanelProcessor, ProcessorContext } from "../processorTypes";
import { createGuidCache, getCachedGuid, isPlayerGuidFast, type GuidCache } from "../processors/guidCache";

/**
 * Attribution info for a death - the damage that caused the kill
 */
export interface DeathAttribution {
  sourceName: string;      // Spell/ability name
  amount: number;          // Damage amount
  school: number;          // Damage school (physical, fire, etc.)
  hitType: number;         // Hit type flags (crit, etc.)
}

/**
 * Data for a single death event
 */
export interface DeathEvent {
  dateMilli: number;  // Absolute timestamp 
  offsetMilli: number;     // Time offset from encounter start
  playerID: string;        // GUID of the player who died
  playerName: string;
  className: string;
  killerID: string;        // GUID of the killer (may be empty)
  killerName: string;      // Name of the killer
  encounterID: string;
  attribution: DeathAttribution | null;  // The damage that killed the player
}

/**
 * Killer data for breakout display
 */
export interface KillerData {
  killerID: string;
  killerName: string;
  count: number;
}

/**
 * Player death summary data
 */
export interface PlayerDeathsData {
  playerID: string;
  playerName: string;
  className: string;
  deathCount: number;
  // Track which enemies killed this player
  killers: Map<string, KillerData>;
}

// UnitDeaths is unit guid -> PlayerDeathsData
export type UnitDeaths = Map<string, PlayerDeathsData>;

export type DeathsResult = {
  // Per-encounter death counts by player
  EncounterDeaths: Map<string, UnitDeaths>;
  // Per-encounter death counts by enemy (non-player units)
  EncounterEnemyDeaths: Map<string, UnitDeaths>;
  // Breakout by killer: playerID -> killerID -> count
  ByKiller: Map<string, Map<string, number>>;
  // Breakout by killer for enemies: enemyID -> killerID -> count
  EnemyByKiller: Map<string, Map<string, number>>;
  // Chronological list of all death events for all encounters
  DeathEvents: DeathEvent[];
  // Chronological list of enemy death events
  EnemyDeathEvents: DeathEvent[];
  // GUID cache for performance (avoids repeated parsing)
  GuidCache: GuidCache;
}

/**
 * Create a deaths processor.
 */
export function createDeathsProcessor(): PanelProcessor<DeathsResult, SlainProcessorEvent> {
  return {
    id: "deaths",
    streams: ["slain"],

    createState: () => ({
      EncounterDeaths: new Map<string, UnitDeaths>(),
      EncounterEnemyDeaths: new Map<string, UnitDeaths>(),
      ByKiller: new Map<string, Map<string, number>>(),
      EnemyByKiller: new Map<string, Map<string, number>>(),
      DeathEvents: [],
      EnemyDeathEvents: [],
      GuidCache: createGuidCache(),
    }),

    processEvent: (
      state: DeathsResult,
      event: SlainProcessorEvent,
      encounterID: string,
      firstTimestamp: Date,
      _streamType: string,
      context: ProcessorContext
    ) => {
      // event.target is the victim (who died)
      if (!event.target) return;

      const guidCache = state.GuidCache;
      const isPlayerDeath = isPlayerGuidFast(event.target);
      
      // Get victim info
      const victimID = event.target;
      let victimName: string;
      let victimClass: string;
      
      if (isPlayerDeath) {
        victimName = context.players[victimID]?.name || victimID;
        victimClass = context.players[victimID]?.class || "UNKNOWN";
      } else {
        victimName = context.units?.[victimID]?.name || victimID;
        victimClass = "ENEMY";
      }

      // Determine killer info
      const killerID = event.caster || "";
      let killerName = "Unknown";
      
      if (killerID) {
        // Check if killer is a player using fast path first
        if (isPlayerGuidFast(killerID) || getCachedGuid(guidCache, killerID).isPlayer()) {
          killerName = context.players[killerID]?.name || killerID;
        } else {
          killerName = context.units?.[killerID]?.name || killerID;
        }
      }

      // Choose appropriate data structures based on whether it's a player or enemy death
      const encounterDeathsMap = isPlayerDeath ? state.EncounterDeaths : state.EncounterEnemyDeaths;
      const byKillerMap = isPlayerDeath ? state.ByKiller : state.EnemyByKiller;
      const deathEventsList = isPlayerDeath ? state.DeathEvents : state.EnemyDeathEvents;

      // Initialize encounter map if needed
      if (!encounterDeathsMap.has(encounterID)) {
        encounterDeathsMap.set(encounterID, new Map<string, PlayerDeathsData>());
      }

      const encounterData = encounterDeathsMap.get(encounterID)!;
      const existing = encounterData.get(victimID) || {
        playerID: victimID,
        playerName: victimName,
        className: victimClass,
        deathCount: 0,
        killers: new Map<string, KillerData>(),
      };

      existing.deathCount++;
      
      // Track killer breakdown
      const killerKey = killerID || "unknown";
      const existingKiller = existing.killers.get(killerKey) || {
        killerID: killerKey,
        killerName,
        count: 0,
      };
      existingKiller.count++;
      existing.killers.set(killerKey, existingKiller);
      
      encounterData.set(victimID, existing);

      // Build attribution if available
      let attribution: DeathAttribution | null = null;
      if (event.attribution) {
        attribution = {
          sourceName: event.attribution.sourceName,
          amount: event.attribution.amount,
          school: event.attribution.school,
          hitType: event.attribution.hitType,
        };
      }

      deathEventsList.push({
        dateMilli: firstTimestamp.getTime() + event.offsetMilli,
        offsetMilli: event.offsetMilli,
        playerID: victimID,
        playerName: victimName,
        className: victimClass,
        killerID,
        killerName,
        encounterID,
        attribution,
      });
        
      if (context.selectedEncounterIds.size == 0 || context.selectedEncounterIds.has(encounterID)) {
        // Breakout by killer
        const killerBreakout = byKillerMap.get(victimID) || new Map<string, number>();
        killerBreakout.set(killerKey, (killerBreakout.get(killerKey) || 0) + 1);
        byKillerMap.set(victimID, killerBreakout);
      }
    },
  };
}

// Pre-created processor for registry
export const deathsProcessor = createDeathsProcessor();
