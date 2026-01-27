/**
 * Hook for aggregating events using a Web Worker.
 */

import { useEffect, useState, useRef } from "react";
import { useInstanceEventsContext } from "./InstanceEventsContext";
import type { 
  WorkerRequest, 
  WorkerResponse, 
  AggregationType,
  StreamType,
  StreamData,
} from "@/workers/damageAggregator.worker";

export interface UseWorkerAggregationOptions {
  aggregationType: AggregationType;
  streams?: StreamType[];  // Default: inferred from aggregationType
  encounterIds?: string[];
  enabled?: boolean;
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

export interface UseWorkerAggregationResult {
  loading: boolean;
  processing: boolean;
  error: Error | null;
  aggregatedData: Map<string, number>;
  totalEvents: number;
  processingTimeMs: number | null;
  progress: {
    currentIdx: number;
    totalEvents: number;
    bytesProcessed: number;
    bytesTotal: number;
  } | null;
}

// Singleton worker instance
let workerInstance: Worker | null = null;

function getWorker(): Worker {
  if (workerInstance) return workerInstance;
  
  // Vite's worker syntax - use relative path for proper bundling
  workerInstance = new Worker(
    new URL("../../workers/damageAggregator.worker.ts", import.meta.url),
    { type: "module" }
  );
  return workerInstance;
}

export function useWorkerAggregation(
  options: UseWorkerAggregationOptions
): UseWorkerAggregationResult {
  const { aggregationType, streams: customStreams, encounterIds, enabled = true } = options;
  const context = useInstanceEventsContext();
  
  // Get streams to fetch (custom or default based on aggregation type)
  const streamTypes = customStreams ?? getDefaultStreams(aggregationType);
  
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [aggregatedData, setAggregatedData] = useState<Map<string, number>>(new Map());
  const [totalEvents, setTotalEvents] = useState(0);
  const [processingTimeMs, setProcessingTimeMs] = useState<number | null>(null);
  const [progress, setProgress] = useState<UseWorkerAggregationResult["progress"]>(null);
  
  const versionRef = useRef(0);
  
  // Create stable key for dependencies
  const encounterKey = encounterIds?.sort().join(",") ?? "";
  const streamsKey = streamTypes.sort().join(",");
  
  useEffect(() => {
    if (!enabled) return;
    
    const version = ++versionRef.current;
    
    async function run() {
      setLoading(true);
      setProcessing(false);
      setError(null);
      setProgress(null);
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
        
        const worker = getWorker();
        
        // Prepare stream data for worker (copy buffers for transfer)
        const streamDataForWorker: StreamData[] = fetchedStreams.map(s => ({
          type: s.type,
          data: s.data.buffer.slice(
            s.data.byteOffset,
            s.data.byteOffset + s.data.byteLength
          ) as ArrayBuffer,
        }));
        
        const request: WorkerRequest = {
          type: "decode",
          streams: streamDataForWorker,
          aggregationType,
          encounterIds: encounterIds,
        };
        
        // Collect transferable buffers
        const transferables = streamDataForWorker.map(s => s.data);
        
        const handleMessage = (event: MessageEvent<WorkerResponse>) => {
          if (version !== versionRef.current) return;
          
          const response = event.data;
          
          if (response.type === "progress") {
            setProgress({
              currentIdx: response.currentIdx,
              totalEvents: response.totalEvents,
              bytesProcessed: response.bytesProcessed,
              bytesTotal: response.bytesTotal,
            });
          } else if (response.type === "complete") {
            setAggregatedData(new Map(Object.entries(response.aggregatedData)));
            setTotalEvents(response.totalEvents);
            setProcessingTimeMs(response.processingTimeMs);
            setProcessing(false);
            console.log(`[useWorkerAggregation] Worker completed in ${response.processingTimeMs.toFixed(2)}ms (${streamTypes.join("+")})`);
          } else if (response.type === "error") {
            setError(new Error(response.error));
            setProcessing(false);
          }
        };
        
        worker.addEventListener("message", handleMessage);
        worker.postMessage(request, transferables);
        
        return () => {
          worker.removeEventListener("message", handleMessage);
        };
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
    progress,
  };
}
