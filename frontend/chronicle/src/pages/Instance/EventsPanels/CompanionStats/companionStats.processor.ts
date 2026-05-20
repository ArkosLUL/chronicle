/**
 * CompanionStats processor — no-op processor.
 * The panel self-manages its aggregation by fetching the companion_stats
 * stream directly, so the worker pipeline is bypassed.
 */

import type { PanelProcessor, ProcessorEvent } from "../processorTypes";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface CompanionStatsResult {}

export const companionStatsProcessor: PanelProcessor<CompanionStatsResult, ProcessorEvent> = {
  id: "companion_stats",
  streams: [],
  createState: (): CompanionStatsResult => ({}),
  processEvent: () => {},
};
