/**
 * Hook for aggregating events based on a PanelDefinition
 */

import { useEffect, useState, useRef } from "react";
import { useInstanceEventsContext } from "@/hooks/instanceEvents";
import { FastDamageCursor } from "@/api/protodecode/decode";
import type { PanelDefinition } from "./types";
import type { StreamType } from "@/hooks/instanceEvents";

export interface UsePanelAggregationOptions<TResult> {
  panel: PanelDefinition<TResult>;
  encounterIds?: string[];
  enabled?: boolean;
}

export interface UsePanelAggregationResult<TResult> {
  loading: boolean;
  processing: boolean;
  error: Error | null;
  result: TResult;
  totalEvents: number;
  processingTimeMs: number | null;
}

export function usePanelAggregation<TResult>(
  options: UsePanelAggregationOptions<TResult>
): UsePanelAggregationResult<TResult> {
  const { panel, encounterIds, enabled = true } = options;
  const context = useInstanceEventsContext();
  
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<TResult>(() => panel.createState());
  const [totalEvents, setTotalEvents] = useState(0);
  const [processingTimeMs, setProcessingTimeMs] = useState<number | null>(null);
  
  const versionRef = useRef(0);
  
  // Create stable keys for dependencies
  const encounterKey = encounterIds?.sort().join(",") ?? "";
  const streamsKey = panel.streams.sort().join(",");
  
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
          panel.streams.map(async (type) => {
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
        
        // Create fresh state for this aggregation
        const state = panel.createState();
        let eventCount = 0;
        
        // Process each stream
        for (const stream of fetchedStreams) {
          eventCount += processStream(
            stream.data,
            stream.type,
            encounterSet,
            state,
            panel.processEvent
          );
        }
        
        const elapsed = performance.now() - startTime;
        
        if (version !== versionRef.current) return;
        
        setResult(state);
        setTotalEvents(eventCount);
        setProcessingTimeMs(elapsed);
        setProcessing(false);
        
        console.log(`[usePanelAggregation:${panel.id}] Completed in ${elapsed.toFixed(2)}ms: ${eventCount} events`);
        
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
  }, [context.fetchStream, panel, streamsKey, encounterKey, enabled]);
  
  return {
    loading,
    processing,
    error,
    result,
    totalEvents,
    processingTimeMs,
  };
}

/**
 * Process a stream using the panel's processEvent callback
 */
function processStream<TResult>(
  data: Uint8Array,
  streamType: StreamType,
  encounterSet: Set<string> | null,
  state: TResult,
  processEvent: PanelDefinition<TResult>["processEvent"]
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
      const event = cursor.next();
      if (!event) break;
      
      eventCount++;
      processEvent(state, event, encounterID, streamType);
    }
    
    cursor.nextEncounter();
  }
  
  return eventCount;
}
