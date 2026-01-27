/**
 * Healing Done processor - aggregates healing by caster (pure TS, worker-safe)
 */

import type { PanelProcessor, ProcessorContext, ProcessorEvent } from "../processorTypes";

export type HealingDoneState = Map<string, number>;

export const healingDoneProcessor: PanelProcessor<HealingDoneState> = {
  id: "healing_done",
  streams: ["heal"],
  
  createState: () => new Map<string, number>(),
  
  processEvent: (
    state: HealingDoneState,
    event: ProcessorEvent,
    _encounterID: string,
    streamType: string,
    context: ProcessorContext
  ) => {
    if (streamType !== "heal") return;
    
    // Filter by selected players if any are selected
    const { entitySelection } = context;
    if (entitySelection.playerIds.length > 0) {
      if (!entitySelection.playerIds.includes(event.caster)) return;
    }
    
    const key = event.caster || "Unknown";
    state.set(key, (state.get(key) || 0) + event.amount);
  },
};
