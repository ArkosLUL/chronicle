/**
 * Shared types for EventsPanels
 */

import type { ReusableDamage } from "@/api/protodecode/decode";
import type { StreamType } from "@/hooks/instanceEvents";

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
 */
export interface PanelDefinition<TResult> {
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
   * Return true to continue processing, false to skip remaining events in encounter.
   */
  processEvent: (
    state: TResult,
    event: ReusableDamage,
    encounterID: string,
    streamType: StreamType,
  ) => void;
  
  /**
   * Render the panel content.
   * Called with the aggregated result and display context.
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
}

/**
 * Common aggregation result: map of entity ID to numeric value
 */
export type EntityValueMap = Map<string, number>;
