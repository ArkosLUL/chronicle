/**
 * Deaths processor - aggregates player deaths from slain events (pure TS, worker-safe)
 */

import { GUID } from "@/lib/guid/guid";
import type { SlainProcessorEvent, PanelProcessor, ProcessorContext } from "../processorTypes";

/**
 * Data for a single death event
 */
export interface DeathEvent {
  offsetMilli: number;     // Time offset from encounter start
  playerID: string;        // GUID of the player who died
  playerName: string;
  className: string;
  killerID: string;        // GUID of the killer (may be empty)
  killerName: string;      // Name of the killer
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
  // Breakout by killer: playerID -> killerID -> count
  ByKiller: Map<string, Map<string, number>>;
  // Chronological list of all death events for selected encounters
  DeathEvents: DeathEvent[];
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
      ByKiller: new Map<string, Map<string, number>>(),
      DeathEvents: [],
    }),

    processEvent: (
      state: DeathsResult,
      event: SlainProcessorEvent,
      encounterID: string,
      _streamType: string,
      context: ProcessorContext
    ) => {
      // event.target is the victim (who died)
      if (!event.target) return;

      const victimGuid = GUID.fromString(event.target);
      
      // Only track player deaths
      if (!victimGuid.isPlayer()) return;

      const playerID = event.target;
      const playerName = context.players[playerID]?.name || playerID;
      const playerClass = context.players[playerID]?.class || "UNKNOWN";

      // Determine killer info
      let killerID = event.caster || "";
      let killerName = "Unknown";
      
      if (killerID) {
        const killerGuid = GUID.fromString(killerID);
        if (killerGuid.isPlayer()) {
          killerName = context.players[killerID]?.name || killerID;
        } else {
          killerName = context.units?.[killerID]?.name || killerID;
        }
      }

      // Initialize encounter map if needed
      if (!state.EncounterDeaths.has(encounterID)) {
        state.EncounterDeaths.set(encounterID, new Map<string, PlayerDeathsData>());
      }

      const encounterData = state.EncounterDeaths.get(encounterID)!;
      const existing = encounterData.get(playerID) || {
        playerID,
        playerName,
        className: playerClass,
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
      
      encounterData.set(playerID, existing);

      // Add to death events list for selected encounters
      if (context.selectedEncounterIds.has(encounterID)) {
        state.DeathEvents.push({
          offsetMilli: event.offsetMilli,
          playerID,
          playerName,
          className: playerClass,
          killerID,
          killerName,
        });
        
        // Breakout by killer
        const killerBreakout = state.ByKiller.get(playerID) || new Map<string, number>();
        killerBreakout.set(killerKey, (killerBreakout.get(killerKey) || 0) + 1);
        state.ByKiller.set(playerID, killerBreakout);
      }
    },
  };
}

// Pre-created processor for registry
export const deathsProcessor = createDeathsProcessor();
