/**
 * Web Worker for panel event processing.
 * 
 * This worker runs panel processors off the main thread to keep UI responsive.
 * It receives stream data and context, processes events, and returns results.
 */

import { FastDamageCursor, FastHealCursor, FastResourceChangeCursor, FastExtraAttackCursor, FastSlainCursor } from "@/api/protodecode/decode";
import { processorRegistry } from "./processors";
import type { WorkerRequest, WorkerResponse, PanelProcessor, ProcessorContext, SerializableProcessorContext } from "./processorTypes";
import type { StreamType } from "@/hooks/instanceEvents";

/**
 * Convert serializable context to ProcessorContext with Sets for fast lookups.
 */
function deserializeContext(ctx: SerializableProcessorContext): ProcessorContext {
  return {
    players: ctx.players,
    units: ctx.units,
    selectedEncounterIds: new Set(ctx.selectedEncounterIds),
    entitySelection: {
      enemyIds: new Set(ctx.entitySelection.enemyIds),
      playerIds: new Set(ctx.entitySelection.playerIds),
    },
  };
}

/**
 * Process all streams using the given processor.
 */
function processStreams<TResult>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  processor: PanelProcessor<TResult, any>,
  streams: WorkerRequest["streams"],
  serializableContext: SerializableProcessorContext
): { result: TResult; totalEvents: number } {
  const state = processor.createState();
  let totalEvents = 0;
  
  // Convert to ProcessorContext with Sets for fast lookups
  const context = deserializeContext(serializableContext);
  
  for (const stream of streams) {
    // Use the appropriate cursor based on stream type
    const cursor = stream.type === "heal" 
      ? new FastHealCursor(stream.data)
      : stream.type === "resource_change"
      ? new FastResourceChangeCursor(stream.data)
      : stream.type === "extra_attack"
      ? new FastExtraAttackCursor(stream.data)
      : stream.type === "slain"
      ? new FastSlainCursor(stream.data)
      : new FastDamageCursor(stream.data);
    
    while (cursor.currentHeader) {
      const encounterID = cursor.currentHeader.encounterID;
      
      while (cursor.hasMoreInEncounter) {
        const event = cursor.next();
        if (!event) break;
        
        totalEvents++;
        processor.processEvent(state, event, encounterID, cursor.currentHeader.firstTimestamp, stream.type as StreamType, context);
      }
      
      cursor.nextEncounter();
    }
  }
  
  return { result: state, totalEvents };
}

// Marker to identify serialized Maps during deserialization
const MAP_MARKER = "__serializedMap__";

interface SerializedMap {
  [MAP_MARKER]: true;
  entries: [unknown, unknown][];
}

/**
 * Deep serialize a value for postMessage (Maps don't serialize through postMessage).
 * Recursively converts Maps to marked objects with serialized entries.
 */
function serializeResult(result: unknown): unknown {
  if (result instanceof Map) {
    const serialized: SerializedMap = {
      [MAP_MARKER]: true,
      entries: Array.from(result.entries()).map(([k, v]) => [k, serializeResult(v)]),
    };
    return serialized;
  }
  if (Array.isArray(result)) {
    return result.map(serializeResult);
  }
  if (result !== null && typeof result === "object") {
    const serialized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(result)) {
      serialized[key] = serializeResult(value);
    }
    return serialized;
  }
  return result;
}

// Handle messages from main thread
self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { requestId, panelId, context, streams } = e.data;
  
  const processor = processorRegistry[panelId];
  if (!processor) {
    const response: WorkerResponse = {
      requestId,
      result: null,
      totalEvents: 0,
      processingTimeMs: 0,
      error: `Unknown panel: ${panelId}`,
    };
    self.postMessage(response);
    return;
  }
  
  try {
    const startTime = performance.now();
    
    const { result, totalEvents } = processStreams(processor, streams, context);
    
    const processingTimeMs = performance.now() - startTime;
    
    const response: WorkerResponse = {
      requestId,
      result: serializeResult(result),
      totalEvents,
      processingTimeMs,
    };
    
    self.postMessage(response);
    
  } catch (err) {
    const response: WorkerResponse = {
      requestId,
      result: null,
      totalEvents: 0,
      processingTimeMs: 0,
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(response);
  }
};
