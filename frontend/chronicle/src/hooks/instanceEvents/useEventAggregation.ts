/**
 * Hook for aggregating events from combat log streams.
 */

import { useEffect, useState, useRef } from "react";
import { useInstanceEventsContext } from "./InstanceEventsContext";
import { FastDamageCursor } from "@/api/protodecode/decode";

export type AggregationType = 
  | "damage_done" 
  | "damage_taken" 
  | "healing_done" 
  | "all_activity";

export type StreamType = "damage" | "extra_attack" | "heal" | "resource_change";

export interface UseEventAggregationOptions {
  aggregationType: AggregationType;
  streams?: StreamType[];
  encounterIds?: string[];
  enabled?: boolean;
}

export interface UseEventAggregationResult {
  loading: boolean;
  processing: boolean;
  error: Error | null;
  aggregatedData: Map<string, number>;
  totalEvents: number;
  processingTimeMs: number | null;
}

/**
 * Get the default streams for an aggregation type
 */
function getDefaultStreams(aggregationType: AggregationType): StreamType[] {
  switch (aggregationType) {
    case "damage_done":
    case "damage_taken":
      return ["damage"];
    case "healing_done":
      return ["heal"];
    case "all_activity":
      return ["damage", "heal", "resource_change"];
  }
}

/**
 * Process a damage stream and aggregate results
 */
function processDamageStream(
  data: Uint8Array,
  aggregationType: AggregationType,
  encounterSet: Set<string> | null,
  aggregated: Map<string, number>
): number {
  const cursor = new FastDamageCursor(data);
  let eventCount = 0;
  
  while (cursor.currentHeader) {
    const encounterID = cursor.currentHeader.encounterID;
    
    if (encounterSet && !encounterSet.has(encounterID)) {
      cursor.nextEncounter();
      continue;
    }
    
    while (cursor.hasMoreInEncounter) {
      const msg = cursor.next();
      if (!msg) break;
      
      eventCount++;
      
      let key: string;
      let amount = msg.amount;
      
      switch (aggregationType) {
        case "damage_done":
          key = msg.caster || "Unknown";
          break;
        case "damage_taken":
          key = msg.target;
          break;
        case "healing_done":
          // Skip damage events in healing mode
          continue;
        case "all_activity":
          key = msg.caster || "Unknown";
          amount = 1; // Just count events
          break;
      }
      
      aggregated.set(key, (aggregated.get(key) || 0) + amount);
    }
    
    cursor.nextEncounter();
  }
  
  return eventCount;
}

/**
 * Process heal/resource streams (similar structure to damage)
 */
function processGenericStream(
  data: Uint8Array,
  streamType: StreamType,
  aggregationType: AggregationType,
  encounterSet: Set<string> | null,
  aggregated: Map<string, number>
): number {
  const cursor = new FastDamageCursor(data);
  let eventCount = 0;
  
  while (cursor.currentHeader) {
    const encounterID = cursor.currentHeader.encounterID;
    
    if (encounterSet && !encounterSet.has(encounterID)) {
      cursor.nextEncounter();
      continue;
    }
    
    while (cursor.hasMoreInEncounter) {
      const msg = cursor.next();
      if (!msg) break;
      
      eventCount++;
      
      let key: string;
      let amount = msg.amount;
      
      switch (aggregationType) {
        case "healing_done":
          if (streamType !== "heal") continue;
          key = msg.caster || "Unknown";
          break;
        case "all_activity":
          key = msg.caster || "Unknown";
          amount = 1;
          break;
        default:
          // damage_done/damage_taken don't use heal/resource streams
          continue;
      }
      
      aggregated.set(key, (aggregated.get(key) || 0) + amount);
    }
    
    cursor.nextEncounter();
  }
  
  return eventCount;
}

export function useEventAggregation(
  options: UseEventAggregationOptions
): UseEventAggregationResult {
  const { aggregationType, streams: customStreams, encounterIds, enabled = true } = options;
  const context = useInstanceEventsContext();
  
  const streamTypes = customStreams ?? getDefaultStreams(aggregationType);
  
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [aggregatedData, setAggregatedData] = useState<Map<string, number>>(new Map());
  const [totalEvents, setTotalEvents] = useState(0);
  const [processingTimeMs, setProcessingTimeMs] = useState<number | null>(null);
  
  const versionRef = useRef(0);
  
  // Create stable keys for dependencies
  const encounterKey = encounterIds?.sort().join(",") ?? "";
  const streamsKey = streamTypes.sort().join(",");
  
  useEffect(() => {
    if (!enabled) return;
    
    const version = ++versionRef.current;
    
    async function run() {
      setLoading(true);
      setProcessing(false);
      setError(null);
      setProcessingTimeMs(null);
      
      try {
        // Fetch all required streams
        const fetchedStreams = await Promise.all(
          streamTypes.map(async (type) => {
            const stream = await context.fetchStream(type);
            return { type, data: stream.data };
          })
        );
        
        if (version !== versionRef.current) return;
        
        setLoading(false);
        setProcessing(true);
        
        const startTime = performance.now();
        
        const encounterSet = encounterIds && encounterIds.length > 0 
          ? new Set(encounterIds) 
          : null;
        
        const aggregated = new Map<string, number>();
        let eventCount = 0;
        
        // Process each stream
        for (const stream of fetchedStreams) {
          if (stream.type === "damage") {
            eventCount += processDamageStream(
              stream.data, aggregationType, encounterSet, aggregated
            );
          } else {
            eventCount += processGenericStream(
              stream.data, stream.type, aggregationType, encounterSet, aggregated
            );
          }
        }
        
        const elapsed = performance.now() - startTime;
        
        if (version !== versionRef.current) return;
        
        setAggregatedData(aggregated);
        setTotalEvents(eventCount);
        setProcessingTimeMs(elapsed);
        setProcessing(false);
        
        console.log(`[useAggregation] Completed in ${elapsed.toFixed(2)}ms: ${eventCount} events (${streamTypes.join("+")})`);
        
      } catch (err) {
        if (version !== versionRef.current) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
        setProcessing(false);
      }
    }
    
    run();
    
    return () => {
      versionRef.current++;
    };
  }, [context.fetchStream, aggregationType, streamsKey, encounterKey, enabled]);
  
  return {
    loading,
    processing,
    error,
    aggregatedData,
    totalEvents,
    processingTimeMs,
  };
}
