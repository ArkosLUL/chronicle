/**
 * All Activity Debug processor - stores raw events for debugging stream interleaving
 */

import type { DamageProcessorEvent, HealProcessorEvent, PanelProcessor, ProcessorContext, ResourceChangeProcessorEvent } from "../processorTypes";
import type { StreamType } from "@/hooks/instanceEvents";

/**
 * A raw event with metadata for debugging
 */
export interface RawDebugEvent {
  index: number;
  offsetMilli: number;
  encounterID: string;
  streamType: StreamType;
  caster: string;
  sourceName: string;
  target: string;
  amount: number;
  extra?: string; // resourceType/school info
}

/**
 * Encounter metadata for display
 */
export interface EncounterMeta {
  encounterID: string;
  firstTimestamp: number; // ms since epoch
}

export interface AllActivityDebugState {
  /** Counts by entity */
  counts: Map<string, number>;
  /** Raw events captured per stream (to ensure fair representation) */
  rawEventsByStream: Record<StreamType, RawDebugEvent[]>;
  /** Count of events per stream type */
  streamCounts: Record<StreamType, number>;
  /** Encounter metadata: encounterID -> first timestamp */
  encounters: Map<string, EncounterMeta>;
}

// This processor only handles damage, heal, and resource_change - not extra_attack
type AllActivityEvent = DamageProcessorEvent | HealProcessorEvent | ResourceChangeProcessorEvent;

// Capture first N events per stream to ensure fair representation
const MAX_RAW_EVENTS_PER_STREAM = 500;

export const allActivityProcessor: PanelProcessor<AllActivityDebugState, AllActivityEvent> = {
  id: "all_activity",
  streams: ["damage", "heal", "resource_change"],
  
  createState: () => ({
    counts: new Map<string, number>(),
    rawEventsByStream: {
      damage: [],
      heal: [],
      resource_change: [],
      extra_attack: [],
      slain: [],
    },
    streamCounts: {
      damage: 0,
      heal: 0,
      resource_change: 0,
      extra_attack: 0,
      slain: 0,
    },
    encounters: new Map<string, EncounterMeta>(),
  }),
  
  processEvent: (
    state: AllActivityDebugState,
    event: AllActivityEvent,
    encounterID: string,
    firstTimestamp: Date,
    streamType: StreamType,
    context: ProcessorContext
  ) => {
    if(!context.selectedEncounterIds.has(encounterID)) {
      return;
    }
    // Track encounter metadata
    if (!state.encounters.has(encounterID)) {
      state.encounters.set(encounterID, {
        encounterID,
        firstTimestamp: firstTimestamp.getTime(),
      });
    }
    
    // Filter by selected players if any are selected
    const { entitySelection } = context;
    if (entitySelection.playerIds.size > 0) {
      if (!entitySelection.playerIds.has(event.caster)) return;
    }
    
    // Count events per stream
    state.streamCounts[streamType]++;
    
    // Count events by caster
    const key = event.caster || "Unknown";
    state.counts.set(key, (state.counts.get(key) || 0) + 1);
    
    // Store first N raw events per stream (ensures fair representation)
    const streamEvents = state.rawEventsByStream[streamType];
    if (streamEvents.length < MAX_RAW_EVENTS_PER_STREAM) {
      const rawEvent: RawDebugEvent = {
        index: event.index,
        offsetMilli: event.offsetMilli,
        encounterID,
        streamType,
        caster: event.caster,
        sourceName: event.sourceName,
        target: event.target,
        amount: event.amount,
      };
      
      // Add stream-specific info
      if (event.type === "resource_change") {
        rawEvent.extra = `${event.resourceType} (${event.direction})`;
      } else if (event.type === "damage" || event.type === "heal") {
        rawEvent.extra = `school=${event.school} hit=${event.hitType}`;
      }
      
      streamEvents.push(rawEvent);
    }
  },
};
