/**
 * Pure TypeScript types for panel processors (worker-safe, no React).
 * 
 * These types are used by both the worker and the main thread.
 * Do NOT import React or any JSX in this file.
 */

import type { StreamType } from "@/hooks/instanceEvents";

/**
 * Minimal event data passed to processEvent.
 * Matches ReusableDamage from protodecode.
 */
export interface ProcessorEvent {
  index: number;
  offsetMilli: number;
  caster: string;
  sourceName: string;
  target: string;
  hitType: number;
  amount: number;
  school: number;
}

/**
 * Selection state for filtering entities (serializable for worker).
 */
export interface SerializableEntitySelection {
  enemyIds: string[];
  playerIds: string[];
}

/**
 * Player info from instance data (subset needed by processors).
 */
export interface ProcessorPlayer {
  name: string;
  class: string;
}

/**
 * Context available to processors (serializable for worker).
 * This is a serializable subset of PanelContext.
 */
export interface ProcessorContext {
  /** Players map: guid -> player info */
  players: Record<string, ProcessorPlayer>;
  
  /** Currently selected encounter IDs */
  selectedEncounterIds: string[];
  
  /** Currently selected entity GUIDs for filtering */
  entitySelection: SerializableEntitySelection;
}

/**
 * Pure processor definition (no React, worker-safe).
 */
export interface PanelProcessor<TResult> {
  /** Unique identifier for this panel type */
  id: string;
  
  /** Which streams this panel needs */
  streams: StreamType[];
  
  /**
   * Create the initial state for aggregation.
   * Must return a serializable value (no functions, no circular refs).
   */
  createState: () => TResult;
  
  /**
   * Process a single event and update the state.
   */
  processEvent: (
    state: TResult,
    event: ProcessorEvent,
    encounterID: string,
    streamType: StreamType,
    context: ProcessorContext,
  ) => void;
}

/**
 * Message sent from main thread to worker.
 */
export interface WorkerRequest {
  requestId: number;
  panelId: string;
  context: ProcessorContext;
  streams: {
    type: StreamType;
    data: Uint8Array;
  }[];
}

/**
 * Message sent from worker to main thread.
 */
export interface WorkerResponse {
  requestId: number;
  result: unknown;
  totalEvents: number;
  processingTimeMs: number;
  error?: string;
}
