/**
 * Hook for aggregating events using a Web Worker.
 * Falls back to main thread if workers are unavailable.
 */

import { useEffect, useState, useRef } from "react";
import { useInstanceEventsContext } from "./InstanceEventsContext";
import { FastDamageCursor, parseAllHeaders } from "@/api/protodecode/decode";
import type { 
  WorkerRequest, 
  WorkerResponse, 
  AggregationType,
  ProgressMessage,
  CompleteMessage,
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
let workerSupported: boolean | null = null;

function getWorker(): Worker | null {
  if (workerSupported === false) return null;
  
  if (workerInstance) return workerInstance;
  
  try {
    // Vite's worker syntax - use relative path for proper bundling
    workerInstance = new Worker(
      new URL("../../workers/damageAggregator.worker.ts", import.meta.url),
      { type: "module" }
    );
    workerSupported = true;
    return workerInstance;
  } catch (err) {
    console.warn("[useWorkerAggregation] Web Worker not supported, falling back to main thread:", err);
    workerSupported = false;
    return null;
  }
}

/**
 * Aggregate on main thread (fallback when workers unavailable)
 */
function aggregateOnMainThread(
  data: Uint8Array,
  aggregationType: AggregationType,
  encounterIds: string[] | undefined,
  onProgress: (progress: ProgressMessage) => void
): CompleteMessage {
  const startTime = performance.now();
  
  const headers = parseAllHeaders(data);
  const encounterSet = encounterIds && encounterIds.length > 0 
    ? new Set(encounterIds) 
    : null;
  
  const relevantHeaders = encounterSet 
    ? headers.filter(h => encounterSet.has(h.encounterID))
    : headers;
  const totalEvents = relevantHeaders.reduce((sum, h) => sum + h.count, 0);
  const bytesTotal = data.length;
  
  const aggregated = new Map<string, number>();
  const cursor = new FastDamageCursor(data);
  const processedEncounters: string[] = [];
  
  let eventCount = 0;
  let lastProgressUpdate = 0;
  const PROGRESS_INTERVAL = 5000;
  
  while (cursor.currentHeader) {
    const encounterID = cursor.currentHeader.encounterID;
    
    if (encounterSet && !encounterSet.has(encounterID)) {
      cursor.nextEncounter();
      continue;
    }
    
    processedEncounters.push(encounterID);
    
    while (cursor.hasMoreInEncounter) {
      const msg = cursor.next();
      if (!msg) break;
      
      eventCount++;
      
      let key: string;
      const amount = msg.amount;
      
      switch (aggregationType) {
        case "damage_done":
        case "all_activity":
          key = msg.caster || "Unknown";
          break;
        case "damage_taken":
          key = msg.target;
          break;
        case "healing_done":
          key = msg.caster || "Unknown";
          break;
        default:
          key = "Unknown";
      }
      
      aggregated.set(key, (aggregated.get(key) || 0) + amount);
      
      if (eventCount - lastProgressUpdate >= PROGRESS_INTERVAL) {
        lastProgressUpdate = eventCount;
        onProgress({
          type: "progress",
          encounterID,
          currentIdx: eventCount,
          totalEvents,
          bytesProcessed: cursor.bytesProcessed,
          bytesTotal,
        });
      }
    }
    
    cursor.nextEncounter();
  }
  
  const processingTimeMs = performance.now() - startTime;
  
  const aggregatedData: Record<string, number> = {};
  for (const [key, value] of aggregated) {
    aggregatedData[key] = value;
  }
  
  return {
    type: "complete",
    aggregatedData,
    totalEvents: eventCount,
    processingTimeMs,
    encounters: processedEncounters,
  };
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
        
        if (worker) {
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
        } else {
          // Fallback to main thread - just use damage stream for now
          // TODO: Support multiple streams in main thread fallback
          const damageStream = fetchedStreams.find(s => s.type === "damage");
          if (!damageStream) {
            throw new Error("No damage stream available for main thread fallback");
          }
          
          console.log("[useWorkerAggregation] Running on main thread (worker unavailable)");
          
          const result = aggregateOnMainThread(
            damageStream.data,
            aggregationType,
            encounterIds,
            (prog) => {
              if (version !== versionRef.current) return;
              setProgress({
                currentIdx: prog.currentIdx,
                totalEvents: prog.totalEvents,
                bytesProcessed: prog.bytesProcessed,
                bytesTotal: prog.bytesTotal,
              });
            }
          );
          
          if (version !== versionRef.current) return;
          
          setAggregatedData(new Map(Object.entries(result.aggregatedData)));
          setTotalEvents(result.totalEvents);
          setProcessingTimeMs(result.processingTimeMs);
          setProcessing(false);
          console.log(`[useWorkerAggregation] Main thread completed in ${result.processingTimeMs.toFixed(2)}ms`);
        }
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
