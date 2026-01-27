/**
 * Damage Done processor - aggregates damage by caster (pure TS, worker-safe)
 */

import { GUID } from "@/lib/guid/guid";
import type { PanelProcessor, ProcessorContext, ProcessorEvent } from "../processorTypes";

/**
 * Player metric data for damage done aggregation.
 * Serializable - no functions or circular refs.
 */
export interface DamageDoneData {
  playerID: string;
  playerName: string;
  className: string;
  specialization: string;
  value: number;
}

export type DamageDoneState = Map<string, DamageDoneData>;

export const damageDoneProcessor: PanelProcessor<DamageDoneState> = {
  id: "damage_done",
  streams: ["damage"],
  
  createState: () => new Map<string, DamageDoneData>(),
  
  processEvent: (
    state: DamageDoneState,
    event: ProcessorEvent,
    _encounterID: string,
    streamType: string,
    context: ProcessorContext
  ) => {
    // Only process damage events
    if (streamType !== "damage") return;
    if (!event.caster) return;
    if (!GUID.fromString(event.caster).isPlayer()) return;
    
    const existing = state.get(event.caster) || { 
      playerID: event.caster,
      value: 0,
      playerName: context.players[event.caster]?.name || "",
      className: context.players[event.caster]?.class || "UNKNOWN",
      specialization: "",
    };
    existing.value += event.amount;
    state.set(event.caster, existing);
  },
};
