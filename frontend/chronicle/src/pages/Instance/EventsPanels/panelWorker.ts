/**
 * Web Worker for panel event processing.
 * 
 * This worker runs panel processors off the main thread to keep UI responsive.
 * It receives stream data and context, processes events, and returns results.
 */

import { FastDamageCursor } from "@/api/protodecode/decode";
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
  processor: PanelProcessor<TResult>,
  streams: WorkerRequest["streams"],
  serializableContext: SerializableProcessorContext
): { result: TResult; totalEvents: number } {
  const state = processor.createState();
  let totalEvents = 0;
  
  // Convert to ProcessorContext with Sets for fast lookups
  const context = deserializeContext(serializableContext);
  
  for (const stream of streams) {
    const cursor = new FastDamageCursor(stream.data);
    
    while (cursor.currentHeader) {
      const encounterID = cursor.currentHeader.encounterID;
      
      while (cursor.hasMoreInEncounter) {
        const event = cursor.next();
        if (!event) break;
        
        totalEvents++;
        processor.processEvent(state, event, encounterID, stream.type as StreamType, context);
      }
      
      cursor.nextEncounter();
    }
  }
  
  return { result: state, totalEvents };
}

/**
 * Convert Map to array for serialization (Maps don't serialize through postMessage).
 */
function serializeResult(result: unknown): unknown {
  if (result instanceof Map) {
    return Array.from(result.entries());
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
