/**
 * Pure TypeScript types for panel processors (worker-safe, no React).
 * 
 * These types are used by both the worker and the main thread.
 * Do NOT import React or any JSX in this file.
 */

import type { StreamType } from "@/hooks/instanceEvents";

/**
 * Common event metadata present in all event types.
 */
interface EventMeta {
  index: number;
  offsetMilli: number;
}

/**
 * Damage event from the "damage" stream.
 */
export interface DamageProcessorEvent extends EventMeta {
  type: "damage";
  caster: string;
  sourceName: string;
  target: string;
  hitType: number;
  amount: number;
  school: number;
}

/**
 * Heal event from the "heal" stream.
 */
export interface HealProcessorEvent extends EventMeta {
  type: "heal";
  caster: string;
  sourceName: string;
  target: string;
  hitType: number;
  amount: number;
  school: number;
}

/**
 * Resource change event from the "resource_change" stream.
 */
export interface ResourceChangeProcessorEvent extends EventMeta {
  type: "resource_change";
  caster: string;
  sourceName: string;
  target: string;
  amount: number;
  resourceType: string;
  direction: string;
}

/**
 * Extra attack event from the "extra_attack" stream.
 * Triggered by abilities like Windfury, Sword Specialization, etc.
 */
export interface ExtraAttackProcessorEvent extends EventMeta {
  type: "extra_attack";
  caster: string;
  sourceName: string;
  target: string;
}

/**
 * Discriminated union of all event types.
 * Use event.type to narrow to a specific type.
 */
export type ProcessorEvent = DamageProcessorEvent | HealProcessorEvent | ResourceChangeProcessorEvent | ExtraAttackProcessorEvent;

/**
 * Selection state for filtering entities (serializable for worker transport).
 * Arrays are used because Sets don't serialize through postMessage.
 */
export interface SerializableEntitySelection {
  enemyIds: string[];
  playerIds: string[];
}

/**
 * Selection state with Sets for fast lookups in processors.
 */
export interface ProcessorEntitySelection {
  enemyIds: Set<string>;
  playerIds: Set<string>;
}

/**
 * Player info from instance data (subset needed by processors).
 */
export interface ProcessorPlayer {
  name: string;
  class: string;
}

/**
 * Unit info from instance data (subset needed by processors).
 */
export interface ProcessorUnit {
  name: string;
  owner: string | null;
  entry: number;
}

/**
 * Serializable context sent to worker via postMessage.
 */
export interface SerializableProcessorContext {
  /** Players map: guid -> player info */
  players: Record<string, ProcessorPlayer>;
  
  /** Units map: guid -> unit info */
  units?: Record<string, ProcessorUnit>;
  
  /** Currently selected encounter IDs */
  selectedEncounterIds: string[];
  
  /** Currently selected entity GUIDs for filtering (arrays for serialization) */
  entitySelection: SerializableEntitySelection;
}

/**
 * Context available to processors with Sets for fast lookups.
 */
export interface ProcessorContext {
  /** Players map: guid -> player info */
  players: Record<string, ProcessorPlayer>;
  
  /** Units map: guid -> unit info */
  units?: Record<string, ProcessorUnit>;
  
  /** Currently selected encounter IDs */
  selectedEncounterIds: Set<string>;
  
  /** Currently selected entity GUIDs for filtering */
  entitySelection: ProcessorEntitySelection;
}

/**
 * Pure processor definition (no React, worker-safe).
 * 
 * @typeParam TResult - The aggregated state type returned by this processor
 * @typeParam TEvent - The event types this processor handles (defaults to all ProcessorEvent types)
 */
export interface PanelProcessor<TResult, TEvent extends ProcessorEvent = ProcessorEvent> {
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
    event: TEvent,
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
  context: SerializableProcessorContext;
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
