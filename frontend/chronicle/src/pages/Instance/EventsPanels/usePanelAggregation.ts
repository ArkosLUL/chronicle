/**
 * Hook for aggregating events based on a PanelDefinition
 */

import { useEffect, useState, useRef } from "react";
import { useInstanceEventsContext } from "@/hooks/instanceEvents";
import { FastDamageCursor } from "@/api/protodecode/decode";
import type { PanelDefinition, PanelContext } from "./types";
import type { StreamType } from "@/hooks/instanceEvents";

export interface UsePanelAggregationOptions<TResult> {
  panel: PanelDefinition<TResult>;
  context: PanelContext;
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

/**
 * Serialize context for comparison. Only includes fields that affect processing.
 */
function serializeContextForComparison(ctx: PanelContext): string {
  return JSON.stringify({
    encounterIds: ctx.selectedEncounterIds.slice().sort(),
    playerIds: Array.from(ctx.entitySelection.playerIds).sort(),
    enemyIds: Array.from(ctx.entitySelection.enemyIds).sort(),
  });
}

export function usePanelAggregation<TResult>(
  options: UsePanelAggregationOptions<TResult>
): UsePanelAggregationResult<TResult> {
  const { panel, context: panelContext, enabled = true } = options;
  const eventsContext = useInstanceEventsContext();
  
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<TResult>(() => panel.createState());
  const [totalEvents, setTotalEvents] = useState(0);
  const [processingTimeMs, setProcessingTimeMs] = useState<number | null>(null);
  
  const versionRef = useRef(0);
  const prevContextRef = useRef<PanelContext | null>(null);
  const cachedStreamsRef = useRef<{ type: StreamType; data: Uint8Array }[] | null>(null);
  
  // Create stable keys for dependencies
  const encounterKey = panelContext.selectedEncounterIds.slice().sort().join(",");
  const streamsKey = panel.streams.slice().sort().join(",");
  const contextKey = serializeContextForComparison(panelContext);
  
  useEffect(() => {
    if (!enabled) return;
    
    const version = ++versionRef.current;
    const prevContext = prevContextRef.current;
    
    // Check if we can skip reprocessing
    let shouldReprocess = true;
    if (prevContext && cachedStreamsRef.current) {
      const prevEncounterKey = prevContext.selectedEncounterIds.slice().sort().join(",");
      if (prevEncounterKey === encounterKey) {
        // Encounter IDs haven't changed - ask panel what to do
        const action = panel.onContextChange?.(prevContext, panelContext) ?? 'reprocess';
        if (action === 'nothing') {
          return; // Skip entirely
        }
        if (action === 'rerender') {
          shouldReprocess = false;
        }
      }
    }
    
    async function run() {
      // If we don't need to reprocess and have cached result, skip fetching
      if (!shouldReprocess && cachedStreamsRef.current) {
        // Just trigger a re-render by updating state reference
        // The result stays the same, but components will re-render with new context
        setResult(r => r);
        prevContextRef.current = panelContext;
        return;
      }
      
      setLoading(true);
      setProcessing(false);
      setError(null);
      setProcessingTimeMs(null);
      
      try {
        // Fetch all required streams (these are cached at the eventsContext level)
        const fetchedStreams = await Promise.all(
          panel.streams.map(async (type) => {
            const stream = await eventsContext.fetchStream(type);
            return { type, data: stream.data };
          })
        );
        
        if (version !== versionRef.current) return;
        
        // Cache streams for potential reuse
        cachedStreamsRef.current = fetchedStreams;
        
        setLoading(false);
        setProcessing(true);
        
        const startTime = performance.now();
        
        // Create fresh state for this aggregation
        const state = panel.createState();
        let eventCount = 0;
        
        // Process each stream - no pre-filtering, panel decides via context
        for (const stream of fetchedStreams) {
          eventCount += processStream(
            stream.data,
            stream.type,
            state,
            panel.processEvent,
            panelContext
          );
        }
        
        const elapsed = performance.now() - startTime;
        
        if (version !== versionRef.current) return;
        
        setResult(state);
        setTotalEvents(eventCount);
        setProcessingTimeMs(elapsed);
        setProcessing(false);
        prevContextRef.current = panelContext;
        
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
  }, [eventsContext.fetchStream, panel, streamsKey, encounterKey, contextKey, enabled, panelContext]);
  
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
 * Process a stream using the panel's processEvent callback.
 * No pre-filtering - all events are passed to processEvent.
 * The panel decides how to filter/aggregate via context.
 */
function processStream<TResult>(
  data: Uint8Array,
  streamType: StreamType,
  state: TResult,
  processEvent: PanelDefinition<TResult>["processEvent"],
  context: PanelContext
): number {
  const cursor = new FastDamageCursor(data);
  let eventCount = 0;
  
  while (cursor.currentHeader) {
    const encounterID = cursor.currentHeader.encounterID;
    
    while (cursor.hasMoreInEncounter) {
      const event = cursor.next();
      if (!event) break;
      
      eventCount++;
      processEvent(state, event, encounterID, streamType, context);
    }
    
    cursor.nextEncounter();
  }
  
  return eventCount;
}
