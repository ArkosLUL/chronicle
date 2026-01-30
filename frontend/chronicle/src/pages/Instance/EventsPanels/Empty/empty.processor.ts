/**
 * Empty processor - A no-op processor for the empty panel.
 * 
 * This processor doesn't process any events or require any streams.
 * It's used when the user wants an empty/collapsed panel slot.
 */

import type { PanelProcessor, ProcessorEvent, ProcessorContext } from "../processorTypes";
import type { StreamType } from "@/hooks/instanceEvents";

/**
 * Result type for the empty processor (just an empty object).
 */
export interface EmptyResult {
  // No data needed
}

/**
 * Empty processor implementation.
 */
export const emptyProcessor: PanelProcessor<EmptyResult, ProcessorEvent> = {
  id: "empty",
  streams: [], // No streams needed
  
  createState: (): EmptyResult => ({}),
  
  processEvent: (
    _state: EmptyResult,
    _event: ProcessorEvent,
    _encounterID: string,
    _firstTimestamp: Date,
    _streamType: StreamType,
    _context: ProcessorContext,
  ): void => {
    // No-op - empty panel doesn't process events
  },
};
