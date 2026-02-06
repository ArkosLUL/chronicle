/**
 * Main thread incremental processor for sync mode.
 * 
 * Unlike the Web Worker which processes all events in one batch, this
 * processor can pause at arbitrary timestamps and resume later.
 * Processing yields to the UI every N events to keep the page responsive.
 */

import { 
  FastDamageCursor, 
  FastHealCursor, 
  FastResourceChangeCursor, 
  FastExtraAttackCursor, 
  FastSlainCursor, 
  FastCastCursor, 
  FastAuraCursor,
  type ReusableDamage,
  type ReusableHeal,
  type ReusableResourceChange,
  type ReusableExtraAttack,
  type ReusableSlain,
  type ReusableCast,
  type ReusableAura,
} from "@/api/protodecode/decode";
import { processorRegistry } from "./processors";
import type { 
  PanelProcessor, 
  ProcessorContext, 
  SerializableProcessorContext,
} from "./processorTypes";
import type { StreamType, CachedStream } from "@/hooks/instanceEvents";

/**
 * Union of all reusable event types
 */
type AnyReusableEvent = ReusableDamage | ReusableHeal | ReusableResourceChange | ReusableExtraAttack | ReusableSlain | ReusableCast | ReusableAura;

/**
 * A cursor wrapper that supports peeking at the next event without consuming it.
 */
interface PeekableCursor {
  streamType: StreamType;
  cursor: FastDamageCursor | FastHealCursor | FastResourceChangeCursor | FastExtraAttackCursor | FastSlainCursor | FastCastCursor | FastAuraCursor;
  peeked: { event: AnyReusableEvent; encounterID: string; firstTimestamp: Date } | null;
}

/**
 * State for incremental processing that can be resumed.
 */
export interface IncrementalProcessorState<TResult> {
  /** The aggregated result state */
  result: TResult;
  /** Total events processed so far */
  processedCount: number;
  /** Last processed timestamp (absolute) for detecting backward seeks */
  lastTimestamp: Date | null;
  /** Number of events processed at lastTimestamp (for precise resume) */
  eventsAtLastTimestamp: number;
  /** Whether processing reached the end of all events */
  isDone: boolean;
}

/**
 * Options for incremental processing.
 */
export interface ProcessIncrementallyOptions<TResult> {
  /** The panel ID to look up processor */
  panelId: string;
  /** Stream data keyed by stream type */
  streams: Map<StreamType, CachedStream>;
  /** Serializable context (will be converted internally) */
  context: SerializableProcessorContext;
  /** Stop processing when event timestamp exceeds this (null = process all) */
  stopAtTimestamp: Date | null;
  /** Previous state to resume from (null = start fresh) */
  previousState: IncrementalProcessorState<TResult> | null;
  /** Callback for progress updates during processing */
  onProgress?: (state: TResult, count: number) => void;
  /** How often to yield to UI (default 1000) */
  yieldEveryN?: number;
}

/**
 * Result of incremental processing.
 */
export interface ProcessIncrementallyResult<TResult> {
  /** The aggregated result state */
  result: TResult;
  /** Total events processed */
  processedCount: number;
  /** Processing time in milliseconds */
  processingTimeMs: number;
  /** Last processed timestamp (absolute) */
  lastTimestamp: Date | null;
  /** Number of events processed at lastTimestamp (for precise resume) */
  eventsAtLastTimestamp: number;
  /** Whether processing reached the end of all events */
  isDone: boolean;
  /** Error message if processing failed */
  error?: string;
}

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
    pagination: ctx.pagination,
  };
}

/**
 * Create a cursor for a stream type.
 */
function createCursor(type: StreamType, data: Uint8Array): PeekableCursor {
  const cursor = type === "heal" 
    ? new FastHealCursor(data)
    : type === "resource_change"
    ? new FastResourceChangeCursor(data)
    : type === "extra_attack"
    ? new FastExtraAttackCursor(data)
    : type === "slain"
    ? new FastSlainCursor(data)
    : type === "cast"
    ? new FastCastCursor(data)
    : type === "aura"
    ? new FastAuraCursor(data)
    : new FastDamageCursor(data);
  
  return {
    streamType: type,
    cursor,
    peeked: null,
  };
}

/**
 * Peek at the next event from a cursor without consuming it.
 */
function peekCursor(pc: PeekableCursor): { event: AnyReusableEvent; encounterID: string; firstTimestamp: Date } | null {
  if (pc.peeked) return pc.peeked;
  
  // Advance to next encounter if needed
  while (pc.cursor.currentHeader && !pc.cursor.hasMoreInEncounter) {
    pc.cursor.nextEncounter();
  }
  
  if (!pc.cursor.currentHeader) return null;
  
  const event = pc.cursor.next();
  if (!event) return null;
  
  pc.peeked = { 
    event, 
    encounterID: pc.cursor.currentHeader.encounterID,
    firstTimestamp: pc.cursor.currentHeader.firstTimestamp,
  };
  return pc.peeked;
}

/**
 * Consume the peeked event (call after processing).
 */
function consumePeeked(pc: PeekableCursor): void {
  pc.peeked = null;
}

/**
 * Yield to the UI thread to keep the page responsive.
 */
function yieldToUI(): Promise<void> {
  return new Promise(resolve => {
    // Use requestAnimationFrame for smoother yielding
    requestAnimationFrame(() => resolve());
  });
}

/**
 * Shallow clone an object to create a new reference for React.
 * This preserves Map/Set instances but creates a new top-level object.
 */
function shallowClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  return { ...obj } as T;
}

/**
 * Check if timestamp moved backward (requires reprocessing from start).
 */
export function timestampMovedBackward(
  newTimestamp: Date | null,
  previousState: IncrementalProcessorState<unknown> | null
): boolean {
  if (!previousState || !previousState.lastTimestamp || !newTimestamp) {
    return false;
  }
  return newTimestamp.getTime() < previousState.lastTimestamp.getTime();
}

/**
 * Process events incrementally on the main thread.
 * 
 * This function:
 * 1. Creates cursors for all required streams
 * 2. Interleaves events by index within each encounter (same as worker)
 * 3. Stops when encountering an event past stopAtTimestamp
 * 4. Yields to UI every yieldEveryN events
 * 5. Returns state that can be resumed later
 */
export async function processIncrementally<TResult>(
  options: ProcessIncrementallyOptions<TResult>
): Promise<ProcessIncrementallyResult<TResult>> {
  const { 
    panelId,
    streams, 
    context: serializableContext, 
    stopAtTimestamp, 
    previousState,
    onProgress,
    yieldEveryN = 10000,
  } = options;

  const startTime = performance.now();

  // Look up processor
  const processor = processorRegistry[panelId] as PanelProcessor<TResult, AnyReusableEvent> | undefined;
  if (!processor) {
    return {
      result: previousState?.result ?? ({} as TResult),
      processedCount: 0,
      processingTimeMs: 0,
      lastTimestamp: null,
      eventsAtLastTimestamp: 0,
      isDone: true,
      error: `Unknown panel: ${panelId}`,
    };
  }

  // Convert context
  const context = deserializeContext(serializableContext);

  // Check for backward seek - must reprocess from start
  const mustRestart = timestampMovedBackward(stopAtTimestamp, previousState);
  
  // Start fresh or resume
  let state: TResult;
  let processedCount: number;
  let lastTimestamp: Date | null;
  let eventsAtLastTimestamp: number;
  let skipUntilTimestamp: number | null; // Skip events BEFORE this timestamp (ms)
  let skipCountAtTimestamp: number; // Skip this many events AT the timestamp

  if (mustRestart || !previousState) {
    state = processor.createState();
    processedCount = 0;
    lastTimestamp = null;
    eventsAtLastTimestamp = 0;
    skipUntilTimestamp = null; // Process all events
    skipCountAtTimestamp = 0;
  } else {
    // Resume from previous state - keep result and skip already processed events
    state = previousState.result;
    processedCount = previousState.processedCount;
    lastTimestamp = previousState.lastTimestamp;
    eventsAtLastTimestamp = previousState.eventsAtLastTimestamp;
    // Skip events BEFORE the last processed timestamp
    skipUntilTimestamp = previousState.lastTimestamp?.getTime() ?? null;
    // And skip this many events AT that timestamp
    skipCountAtTimestamp = previousState.eventsAtLastTimestamp;
    
    // If we already finished, just return the previous state
    // (clone to ensure new reference for React)
    if (previousState.isDone) {
      return {
        result: shallowClone(state),
        processedCount,
        processingTimeMs: 0,
        lastTimestamp,
        eventsAtLastTimestamp,
        isDone: true,
      };
    }
  }
  
  // Counter for events seen at the boundary timestamp
  let eventsSeenAtBoundary = 0;

  // Create cursors for all streams
  const cursors: PeekableCursor[] = [];
  for (const streamType of processor.streams) {
    const cachedStream = streams.get(streamType);
    if (cachedStream) {
      const cursor = createCursor(streamType, cachedStream.data);
      
      // Skip entire encounters that end before our resume timestamp.
      // This avoids decoding events we know we'll skip - skipEncounter() 
      // uses dataLength to jump directly by byte offset (no decoding needed).
      if (skipUntilTimestamp !== null) {
        while (cursor.cursor.currentHeader) {
          const header = cursor.cursor.currentHeader;
          // We don't know exact encounter end time, only start time.
          // Use conservative heuristic: skip if start is 60+ seconds before resume time.
          // This ensures we don't skip encounters that might contain events we need.
          const encounterStart = header.firstTimestamp.getTime();
          if (encounterStart < skipUntilTimestamp - 60000) {
            cursor.cursor.skipEncounter();
          } else {
            break;
          }
        }
      }
      
      cursors.push(cursor);
    }
  }

  let localCount = 0;

  // Process one encounter at a time (same as worker)
  while (true) {
    // Find the current encounter: pick the one with earliest timestamp among all cursors
    let currentEncounterID: string | null = null;
    let currentEncounterTimestamp: Date | null = null;
    
    for (const pc of cursors) {
      const peeked = peekCursor(pc);
      if (peeked && (!currentEncounterTimestamp || peeked.firstTimestamp < currentEncounterTimestamp)) {
        currentEncounterID = peeked.encounterID;
        currentEncounterTimestamp = peeked.firstTimestamp;
      }
    }
    
    // No more events in any stream
    if (!currentEncounterID || !currentEncounterTimestamp) break;
    
    // Process all events from this encounter across all streams, interleaved by index
    while (true) {
      let minCursor: PeekableCursor | null = null;
      let minPeeked: { event: AnyReusableEvent; encounterID: string; firstTimestamp: Date } | null = null;
      
      for (const pc of cursors) {
        const peeked = peekCursor(pc);
        // Only consider events from the current encounter
        if (peeked && peeked.encounterID === currentEncounterID) {
          if (!minPeeked || peeked.event.index < minPeeked.event.index) {
            minCursor = pc;
            minPeeked = peeked;
          }
        }
      }
      
      // No more events from this encounter - move to next encounter
      if (!minCursor || !minPeeked) break;
      
      const eventTime = minPeeked.firstTimestamp.getTime() + minPeeked.event.offsetMilli;
      
      // Skip events we've already processed (for resume)
      if (skipUntilTimestamp !== null) {
        // Skip all events BEFORE the boundary timestamp
        if (eventTime < skipUntilTimestamp) {
          consumePeeked(minCursor);
          continue;
        }
        // At the boundary timestamp, skip exactly the number we already processed
        if (eventTime === skipUntilTimestamp) {
          eventsSeenAtBoundary++;
          if (eventsSeenAtBoundary <= skipCountAtTimestamp) {
            consumePeeked(minCursor);
            continue;
          }
        }
      }
      
      // Check timestamp cutoff BEFORE processing
      if (stopAtTimestamp) {
        if (eventTime > stopAtTimestamp.getTime()) {
          // Stop here - return state that can be resumed
          // Clone to ensure new reference for React
          const processingTimeMs = performance.now() - startTime;
          return {
            result: shallowClone(state),
            processedCount,
            processingTimeMs,
            lastTimestamp,
            eventsAtLastTimestamp,
            isDone: false,
          };
        }
        // Track events at each timestamp for precise resume
        const lastTimestampMs = lastTimestamp?.getTime() ?? null;
        if (lastTimestampMs === eventTime) {
          eventsAtLastTimestamp++;
        } else {
          lastTimestamp = new Date(eventTime);
          eventsAtLastTimestamp = 1;
        }
      }
      
      // Process the event
      processor.processEvent(
        state, 
        minPeeked.event, 
        minPeeked.encounterID, 
        minPeeked.firstTimestamp, 
        minCursor.streamType, 
        context
      );
      
      consumePeeked(minCursor);
      processedCount++;
      localCount++;
      
      // Yield to UI every N events
      if (localCount % yieldEveryN === 0) {
        onProgress?.(state, processedCount);
        await yieldToUI();
      }
    }
  }

  const processingTimeMs = performance.now() - startTime;
  
  // Clone to ensure new reference for React
  return {
    result: shallowClone(state),
    processedCount,
    processingTimeMs,
    lastTimestamp,
    eventsAtLastTimestamp,
    isDone: true,
  };
}
