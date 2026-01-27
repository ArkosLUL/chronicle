/**
 * Web Worker for decoding and aggregating events off the main thread.
 * 
 * This worker receives raw protobuf data and returns aggregated results,
 * avoiding the overhead of transferring 100k+ individual events.
 */

import { FastDamageCursor, parseAllHeaders } from "@/api/protodecode/decode";

export type AggregationType = 
  | "damage_done" 
  | "damage_taken" 
  | "healing_done" 
  | "all_activity";  // Counts all events by source across all streams

export type StreamType = "damage" | "heal" | "resource_change";

export interface StreamData {
  type: StreamType;
  data: ArrayBuffer;
}

export interface WorkerRequest {
  type: "decode";
  streams: StreamData[];  // Multiple streams for combined processing
  aggregationType: AggregationType;
  encounterIds?: string[]; // Filter to specific encounters (empty = all)
}

export interface ProgressMessage {
  type: "progress";
  encounterID: string;
  currentIdx: number;
  totalEvents: number;
  bytesProcessed: number;
  bytesTotal: number;
}

export interface CompleteMessage {
  type: "complete";
  aggregatedData: Record<string, number>; // playerId -> total amount
  totalEvents: number;
  processingTimeMs: number;
  encounters: string[];
}

export interface ErrorMessage {
  type: "error";
  error: string;
}

export type WorkerResponse = ProgressMessage | CompleteMessage | ErrorMessage;

/**
 * Process a single damage stream
 */
function processDamageStream(
  data: Uint8Array,
  aggregationType: AggregationType,
  encounterSet: Set<string> | null,
  aggregated: Map<string, number>,
  processedEncounters: string[],
  onProgress: (encounterID: string, eventCount: number, bytesProcessed: number) => void
): number {
  const cursor = new FastDamageCursor(data);
  let eventCount = 0;
  
  while (cursor.currentHeader) {
    const encounterID = cursor.currentHeader.encounterID;
    
    if (encounterSet && !encounterSet.has(encounterID)) {
      cursor.nextEncounter();
      continue;
    }
    
    if (!processedEncounters.includes(encounterID)) {
      processedEncounters.push(encounterID);
    }
    
    while (cursor.hasMoreInEncounter) {
      const msg = cursor.next();
      if (!msg) break;
      
      eventCount++;
      
      let key: string;
      let amount = msg.amount;
      
      switch (aggregationType) {
        case "damage_done":
        case "all_activity":
          key = msg.caster || "Unknown";
          break;
        case "damage_taken":
          key = msg.target;
          break;
        case "healing_done":
          // Skip damage in healing mode
          continue;
      }
      
      // For all_activity, just count events (amount = 1)
      if (aggregationType === "all_activity") {
        amount = 1;
      }
      
      aggregated.set(key, (aggregated.get(key) || 0) + amount);
      
      if (eventCount % 5000 === 0) {
        onProgress(encounterID, eventCount, cursor.bytesProcessed);
      }
    }
    
    cursor.nextEncounter();
  }
  
  return eventCount;
}

/**
 * Process heal/resource streams using the generic cursor approach
 * For now, uses the same FastDamageCursor structure (assumes similar binary format)
 */
function processGenericStream(
  data: Uint8Array,
  streamType: StreamType,
  aggregationType: AggregationType,
  encounterSet: Set<string> | null,
  aggregated: Map<string, number>,
  processedEncounters: string[],
  onProgress: (encounterID: string, eventCount: number, bytesProcessed: number) => void
): number {
  // For heal and resource_change, we use FastDamageCursor since they have similar structure
  // The decoder reads: caster, target, amount fields which exist in all message types
  const cursor = new FastDamageCursor(data);
  let eventCount = 0;
  
  while (cursor.currentHeader) {
    const encounterID = cursor.currentHeader.encounterID;
    
    if (encounterSet && !encounterSet.has(encounterID)) {
      cursor.nextEncounter();
      continue;
    }
    
    if (!processedEncounters.includes(encounterID)) {
      processedEncounters.push(encounterID);
    }
    
    while (cursor.hasMoreInEncounter) {
      const msg = cursor.next();
      if (!msg) break;
      
      eventCount++;
      
      let key: string;
      let amount = msg.amount;
      
      if (streamType === "heal") {
        switch (aggregationType) {
          case "healing_done":
          case "all_activity":
            key = msg.caster || "Unknown";
            break;
          case "damage_done":
          case "damage_taken":
            // Skip healing in damage modes
            continue;
        }
      } else {
        // resource_change - count by caster for all_activity
        if (aggregationType !== "all_activity") continue;
        key = msg.caster || "Unknown";
      }
      
      // For all_activity, just count events
      if (aggregationType === "all_activity") {
        amount = 1;
      }
      
      aggregated.set(key, (aggregated.get(key) || 0) + amount);
      
      if (eventCount % 5000 === 0) {
        onProgress(encounterID, eventCount, cursor.bytesProcessed);
      }
    }
    
    cursor.nextEncounter();
  }
  
  return eventCount;
}

// Worker message handler
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { type, streams, aggregationType, encounterIds } = event.data;

  if (type !== "decode") {
    self.postMessage({ type: "error", error: `Unknown request type: ${type}` } satisfies ErrorMessage);
    return;
  }

  if (!streams || streams.length === 0) {
    self.postMessage({ type: "error", error: "No streams provided" } satisfies ErrorMessage);
    return;
  }

  try {
    const startTime = performance.now();
    
    const encounterSet = encounterIds && encounterIds.length > 0 
      ? new Set(encounterIds) 
      : null;
    
    // Calculate totals across all streams
    let totalEvents = 0;
    let bytesTotal = 0;
    for (const stream of streams) {
      const data = new Uint8Array(stream.data);
      const headers = parseAllHeaders(data);
      const relevant = encounterSet 
        ? headers.filter(h => encounterSet.has(h.encounterID))
        : headers;
      totalEvents += relevant.reduce((sum, h) => sum + h.count, 0);
      bytesTotal += data.length;
    }
    
    const aggregated = new Map<string, number>();
    const processedEncounters: string[] = [];
    let eventCount = 0;
    let bytesProcessed = 0;
    
    const onProgress = (encounterID: string, count: number, bytes: number) => {
      self.postMessage({
        type: "progress",
        encounterID,
        currentIdx: eventCount + count,
        totalEvents,
        bytesProcessed: bytesProcessed + bytes,
        bytesTotal,
      } satisfies ProgressMessage);
    };
    
    // Process each stream
    for (const stream of streams) {
      const data = new Uint8Array(stream.data);
      
      let count: number;
      if (stream.type === "damage") {
        count = processDamageStream(
          data, aggregationType, encounterSet, aggregated, processedEncounters, onProgress
        );
      } else {
        count = processGenericStream(
          data, stream.type, aggregationType, encounterSet, aggregated, processedEncounters, onProgress
        );
      }
      
      eventCount += count;
      bytesProcessed += data.length;
    }
    
    const processingTimeMs = performance.now() - startTime;
    
    // Convert Map to plain object for transfer
    const aggregatedData: Record<string, number> = {};
    for (const [key, value] of aggregated) {
      aggregatedData[key] = value;
    }
    
    self.postMessage({
      type: "complete",
      aggregatedData,
      totalEvents: eventCount,
      processingTimeMs,
      encounters: processedEncounters,
    } satisfies CompleteMessage);
    
  } catch (err) {
    self.postMessage({
      type: "error",
      error: err instanceof Error ? err.message : String(err),
    } satisfies ErrorMessage);
  }
};
