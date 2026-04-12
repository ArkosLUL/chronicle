/**
 * Logging Metadata processor - A no-op processor for the logging metadata panel.
 *
 * This panel displays instance-level metadata (versions, recorder info)
 * and doesn't need to process any event streams.
 */

import type { PanelProcessor, ProcessorEvent } from "../processorTypes";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface LoggingMetadataResult {}

export const loggingMetadataProcessor: PanelProcessor<LoggingMetadataResult, ProcessorEvent> = {
  id: "logging_metadata",
  streams: [],
  createState: (): LoggingMetadataResult => ({}),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  processEvent: (_state, _event, _encounterID, _firstTimestamp, _streamType, _context) => {},
};
