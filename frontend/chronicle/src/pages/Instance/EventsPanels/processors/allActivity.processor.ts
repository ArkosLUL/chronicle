/**
 * All Activity processor - counts all events by caster (pure TS, worker-safe)
 */

import type { PanelProcessor, ProcessorContext, ProcessorEvent } from "../processorTypes";

export type AllActivityState = Map<string, number>;

export const allActivityProcessor: PanelProcessor<AllActivityState> = {
  id: "all_activity",
  streams: ["damage", "heal", "resource_change"],
  
  createState: () => new Map<string, number>(),
  
  processEvent: (
    state: AllActivityState,
    event: ProcessorEvent,
    _encounterID: string,
    _streamType: string,
    context: ProcessorContext
  ) => {
    // Filter by selected players if any are selected
    const { entitySelection } = context;
    if (entitySelection.playerIds.size > 0) {
      if (!entitySelection.playerIds.has(event.caster)) return;
    }
    
    // Count events, not amounts
    const key = event.caster || "Unknown";
    state.set(key, (state.get(key) || 0) + 1);
  },
};
