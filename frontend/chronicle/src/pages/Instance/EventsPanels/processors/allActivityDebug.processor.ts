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
  streamType: StreamType;
  caster: string;
  sourceName: string;
  target: string;
  amount: number;
  extra?: string; // resourceType/school info
}

export interface AllActivityDebugState {
  /** Counts by entity */
  counts: Map<string, number>;
  /** Raw events in index order (worker now interleaves streams properly) */
  rawEvents: RawDebugEvent[];
  /** Count of events per stream type */
  streamCounts: Record<StreamType, number>;
}

// This processor only handles damage, heal, and resource_change - not extra_attack
type AllActivityEvent = DamageProcessorEvent | HealProcessorEvent | ResourceChangeProcessorEvent;

// Capture first N events (worker interleaves by index, so this captures true order)
const MAX_RAW_EVENTS = 500;

export const allActivityProcessor: PanelProcessor<AllActivityDebugState, AllActivityEvent> = {
  id: "all_activity",
  streams: ["damage", "heal", "resource_change"],
  
  createState: () => ({
    counts: new Map<string, number>(),
    rawEvents: [],
    streamCounts: {
      damage: 0,
      heal: 0,
      resource_change: 0,
      extra_attack: 0,
      slain: 0,
    },
  }),
  
  processEvent: (
    state: AllActivityDebugState,
    event: AllActivityEvent,
    _encounterID: string,
    _firstTimestamp: Date,
    streamType: StreamType,
    context: ProcessorContext
  ) => {
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
    
    // Store first N raw events (worker now interleaves by index)
    if (state.rawEvents.length < MAX_RAW_EVENTS) {
      const rawEvent: RawDebugEvent = {
        index: event.index,
        offsetMilli: event.offsetMilli,
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
      
      state.rawEvents.push(rawEvent);
    }
  },
};
