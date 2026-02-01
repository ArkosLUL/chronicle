/**
 * All Activity Debug processor - stores raw events for debugging stream interleaving
 */

import type { DamageProcessorEvent, HealProcessorEvent, PanelProcessor, ProcessorContext, ResourceChangeProcessorEvent, CastProcessorEvent, CastAction } from "../processorTypes";
import type { StreamType } from "@/hooks/instanceEvents";

/**
 * A raw event with metadata for debugging
 */
/**
 * Resource types from WoW combat log
 */
export type ResourceType = "Health" | "Mana" | "Rage" | "Happiness" | "Energy" | "Focus";

export interface RawDebugEvent {
  index: number;
  offsetMilli: number;
  encounterID: string;
  streamType: StreamType;
  caster: string;
  sourceName: string;
  target: string;
  targetName: string;
  amount: number;
  resourceType?: ResourceType; // For resource_change events
  extra?: string; // school/hitType info
  // Cast-specific fields
  castAction?: CastAction;
  spellId?: number;
  spellRank?: number | null;
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

// This processor handles damage, heal, resource_change, and cast events
type AllActivityEvent = DamageProcessorEvent | HealProcessorEvent | ResourceChangeProcessorEvent | CastProcessorEvent;

// Capture first N events per stream to ensure fair representation
const MAX_RAW_EVENTS_PER_STREAM = 500;

export const allActivityProcessor: PanelProcessor<AllActivityDebugState, AllActivityEvent> = {
  id: "all_activity",
  streams: ["damage", "heal", "resource_change", "casts"],
  
  createState: () => ({
    counts: new Map<string, number>(),
    rawEventsByStream: {
      damage: [],
      heal: [],
      resource_change: [],
      extra_attack: [],
      slain: [],
      casts: [],
    },
    streamCounts: {
      damage: 0,
      heal: 0,
      resource_change: 0,
      extra_attack: 0,
      slain: 0,
      casts: 0,
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
    // Cast events have caster but may not have target
    const eventCaster = event.caster;
    const eventTarget = "target" in event ? event.target : "";
    if (entitySelection.playerIds.size > 0) {
      if(!(entitySelection.playerIds.has(eventCaster) || (eventTarget && entitySelection.playerIds.has(eventTarget)))) {
        return;
      }
    }
    
    // Count events per stream
    state.streamCounts[streamType]++;
    
    // Count events by caster
    const key = eventCaster || "Unknown";
    state.counts.set(key, (state.counts.get(key) || 0) + 1);
    
    // Store first N raw events per stream (ensures fair representation)
    const streamEvents = state.rawEventsByStream[streamType];
    if (streamEvents.length < MAX_RAW_EVENTS_PER_STREAM) {
      // Look up target name from players or units
      const targetName = eventTarget
        ? (context.players[eventTarget]?.name ?? 
           context.units?.[eventTarget]?.name ?? 
           eventTarget)
        : "";
      
      // Get sourceName - cast events use spell.name instead
      let sourceName = "";
      let amount = 0;
      if (streamType === "casts") {
        const castEvent = event as CastProcessorEvent;
        sourceName = castEvent.spell.name;
        amount = 0; // Casts don't have an amount
      } else {
        const regularEvent = event as DamageProcessorEvent | HealProcessorEvent | ResourceChangeProcessorEvent;
        sourceName = regularEvent.sourceName;
        amount = regularEvent.amount;
      }
      
      const rawEvent: RawDebugEvent = {
        index: event.index,
        offsetMilli: event.offsetMilli,
        encounterID,
        streamType,
        caster: eventCaster,
        sourceName,
        target: eventTarget,
        targetName,
        amount,
      };
      
      // Add stream-specific info based on streamType
      if (streamType === "resource_change") {
        const rcEvent = event as ResourceChangeProcessorEvent;
        rawEvent.resourceType = rcEvent.resourceType as ResourceType;
        rawEvent.extra = rcEvent.direction;
      } else if (streamType === "damage" || streamType === "heal") {
        const dhEvent = event as DamageProcessorEvent | HealProcessorEvent;
        rawEvent.extra = `school=${dhEvent.school} hit=${dhEvent.hitType}`;
      } else if (streamType === "casts") {
        const castEvent = event as CastProcessorEvent;
        rawEvent.castAction = castEvent.action;
        rawEvent.spellId = castEvent.spell.id;
        rawEvent.spellRank = castEvent.spell.rank;
        // Show cast action in extra field
        const actionNames = ["Unknown", "Casts", "Begins", "Channels", "Fails"];
        rawEvent.extra = actionNames[castEvent.action] || "Unknown";
      }
      
      streamEvents.push(rawEvent);
    }
  },
};
