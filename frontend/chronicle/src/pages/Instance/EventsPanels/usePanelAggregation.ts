/**
 * Hook for aggregating events based on a PanelDefinition.
 * Uses a Web Worker for processing to keep the UI responsive.
 */

import { useEffect, useState, useRef } from "react";
import { useInstanceEventsContext } from "@/hooks/instanceEvents";
import type { PanelDefinition, PanelContext } from "./types";
import type { WorkerRequest, WorkerResponse, SerializableProcessorContext } from "./processorTypes";

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
 * Convert PanelContext to serializable ProcessorContext for the worker.
 * Arrays are used for Sets since they can't be serialized through postMessage.
 */
function toSerializableContext(ctx: PanelContext): SerializableProcessorContext {
  // Extract only the fields needed by processors
  const players: SerializableProcessorContext["players"] = {};
  if (ctx.instance.players) {
    for (const [guid, player] of Object.entries(ctx.instance.players)) {
      players[guid] = {
        name: player.name,
        class: player.class,
      };
    }
  }
  
  // Extract units (convert GUID to string if needed)
  const units: SerializableProcessorContext["units"] = {};
  if (ctx.instance.units) {
    for (const [guid, unit] of Object.entries(ctx.instance.units)) {
      units[guid] = {
        name: unit.name,
        owner: unit.owner?.toString() ?? null,
        entry: unit.entry,
      };
    }
  }
  
  return {
    players,
    units,
    selectedEncounterIds: ctx.selectedEncounterIds,
    entitySelection: {
      enemyIds: Array.from(ctx.entitySelection.enemyIds),
      playerIds: Array.from(ctx.entitySelection.playerIds),
    },
  };
}

// Marker used by worker to identify serialized Maps
const MAP_MARKER = "__serializedMap__";

interface SerializedMap {
  [MAP_MARKER]: true;
  entries: [unknown, unknown][];
}

function isSerializedMap(value: unknown): value is SerializedMap {
  return (
    value !== null &&
    typeof value === "object" &&
    MAP_MARKER in value &&
    (value as SerializedMap)[MAP_MARKER] === true
  );
}

/**
 * Recursively deserialize a value from worker.
 * Objects with MAP_MARKER are converted back to Maps.
 */
function deepDeserialize(value: unknown): unknown {
  // Check for serialized Map marker
  if (isSerializedMap(value)) {
    return new Map(
      value.entries.map(([k, v]) => [k, deepDeserialize(v)])
    );
  }
  
  // Recursively deserialize arrays
  if (Array.isArray(value)) {
    return value.map(deepDeserialize);
  }
  
  // Recursively deserialize object properties
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = deepDeserialize(val);
    }
    return result;
  }
  
  return value;
}

/**
 * Deserialize worker result back to the expected type.
 * Worker serializes Maps with a marker for identification.
 */
function deserializeResult<TResult>(result: unknown): TResult {
  return deepDeserialize(result) as TResult;
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
  
  const requestIdRef = useRef(0);
  const workerRef = useRef<Worker | null>(null);
  
  // Track panel id in state to detect changes during render
  // This is the React-approved pattern for "adjusting state when a prop changes"
  // See: https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevPanelId, setPrevPanelId] = useState(panel.id);
  if (prevPanelId !== panel.id) {
    setPrevPanelId(panel.id);
    setResult(panel.createState());
  }
  
  // Create stable key for streams (panels define which streams they need)
  const streamsKey = panel.streams.slice().sort().join(",");
  
  useEffect(() => {
    if (!enabled) return;
    
    const requestId = ++requestIdRef.current;
    
    async function run() {
      // Terminate any existing worker
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
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
        
        // Check if request was superseded while fetching
        if (requestId !== requestIdRef.current) return;
        
        setLoading(false);
        setProcessing(true);
        
        // Create worker
        const worker = new Worker(
          new URL('./panelWorker.ts', import.meta.url),
          { type: 'module' }
        );
        workerRef.current = worker;
        
        // Set up message handler
        worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
          const response = e.data;
          
          // Ignore stale responses
          if (response.requestId !== requestIdRef.current) {
            return;
          }
          
          if (response.error) {
            setError(new Error(response.error));
            setProcessing(false);
            return;
          }
          
          const deserializedResult = deserializeResult<TResult>(response.result);
          setResult(deserializedResult);
          setTotalEvents(response.totalEvents);
          setProcessingTimeMs(response.processingTimeMs);
          setProcessing(false);
        };
        
        worker.onerror = (e) => {
          if (requestId !== requestIdRef.current) return;
          setError(new Error(e.message || 'Worker error'));
          setProcessing(false);
        };
        
        // Send work to worker
        const workerRequest: WorkerRequest = {
          requestId,
          panelId: panel.id,
          context: toSerializableContext(panelContext),
          streams: fetchedStreams,
        };
        
        worker.postMessage(workerRequest);
        
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
        setProcessing(false);
      }
    }
    
    run();
    
    // Cleanup: terminate worker on unmount or when deps change
    return () => {
      requestIdRef.current++;
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [eventsContext.fetchStream, panel, streamsKey, enabled, panelContext]);
  
  return {
    loading,
    processing,
    error,
    result,
    totalEvents,
    processingTimeMs,
  };
}
