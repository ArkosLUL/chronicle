/**
 * Damage Taken processor - aggregates damage by target (pure TS, worker-safe)
 */

import { hasHitType, HitTypeCrit } from "@/lib/hittype/hittype";
import type { PanelProcessor, ProcessorContext, ProcessorEvent } from "../processorTypes";

export type DamageTakenState = Map<string, number>;

export const damageTakenProcessor: PanelProcessor<DamageTakenState> = {
  id: "damage_taken",
  streams: ["damage"],
  
  createState: () => new Map<string, number>(),
  
  processEvent: (
    state: DamageTakenState,
    event: ProcessorEvent,
    _encounterID: string,
    streamType: string,
    context: ProcessorContext
  ) => {
    if (streamType !== "damage") return;
    
    // Filter by selected enemies if any are selected
    const { entitySelection } = context;
    if (entitySelection.enemyIds.size > 0) {
      if (!entitySelection.enemyIds.has(event.target)) return;
    }
    
    const key = event.target;
    state.set(key, (state.get(key) || 0) + event.amount);
  },
};
