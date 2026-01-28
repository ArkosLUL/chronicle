/**
 * Shared types for EventsPanels
 */

import type { PlayerMetricChartData } from "@/components/ui/PlayerMetricChart/PlayerMetricChart";
import type { StreamType } from "@/hooks/instanceEvents";
import type { Instance, Encounter } from "../InstancePage";
import type { ProcessorContext, ProcessorEvent } from "./processorTypes";
import type { ReusableDamage } from "@/api/protodecode/decode";

/**
 * Selection state for filtering entities
 */
export interface EntitySelection {
  enemyIds: Set<string>;
  playerIds: Set<string>;
}

/**
 * Context available to panels for processing and rendering.
 */
export interface PanelContext {
  /** The full instance data (players, encounters, metadata) */
  instance: Instance;
  
  /** Currently selected encounter IDs */
  selectedEncounterIds: string[];
  
  /** Currently selected entity GUIDs for filtering display */
  entitySelection: EntitySelection;
}

/**
 * Callback invoked for each event during aggregation.
 * The event object is reused - do not store references to it.
 */
export type EventCallback = (event: ReusableDamage, encounterID: string) => void;

/**
 * Function that processes events and builds aggregated data.
 * Called with a callback that will be invoked for each event.
 */
export type AggregatorFn = (
  onEvent: EventCallback,
  encounterID: string,
) => void;

/**
 * Configuration for a panel type
 * 
 * @typeParam TResult - The aggregated state type returned by this processor
 * @typeParam TEvent - The event types this processor handles (defaults to all ProcessorEvent types)
 */
export interface PanelDefinition<TResult, TEvent extends ProcessorEvent = ProcessorEvent> {
  /** Unique identifier for this panel type */
  id: string;
  
  /** Display label */
  label: string;
  
  /** Icon component */
  icon: React.ReactNode;
  
  /** Which streams this panel needs */
  streams: StreamType[];
  
  /**
   * Create the initial state for aggregation
   */
  createState: () => TResult;
  
  /**
   * Process a single event and update the state.
   * Runs in a Web Worker with serializable ProcessorContext.
   */
  processEvent: (
    state: TResult,
    event: TEvent,
    encounterID: string,
    firstTimestamp: Date,
    streamType: StreamType,
    context: ProcessorContext,
  ) => void;
  
  /**
   * Render the panel content.
   * Called with the aggregated result and display context.
   * 
   * Components inside render can decide their own caching strategy:
   * - Use `props.result` directly for always-fresh data
   * - Cache result when `props.loading` becomes true for static data
   */
  render: (props: PanelRenderProps<TResult>) => React.ReactNode;
}

export interface PanelRenderProps<TResult> {
  /** The aggregated state */
  result: TResult;
  
  /** Total events processed */
  totalEvents: number;
  
  /** Processing time in ms */
  processingTimeMs: number | null;
  
  /** Duration of selected encounters in ms */
  durationMs: number;
  
  /** Whether to show per-second values */
  perSecond: boolean;
  
  /** Loading state */
  loading: boolean;
  
  /** Processing state */
  processing: boolean;
  
  /** Error if any */
  error: Error | null;
  
  /** Full context for rendering (instance data, selections) */
  context: PanelContext;
}

/**
 * Common aggregation result: map of entity ID to numeric value
 */
export type EntityValueMap = Map<string, number>;

export type PlayerMetricChartMap = Map<string, PlayerMetricChartData>;