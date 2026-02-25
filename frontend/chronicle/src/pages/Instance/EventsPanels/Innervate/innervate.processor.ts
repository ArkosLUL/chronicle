/**
 * Innervate processor - Tracks Innervate casts by Druids.
 * 
 * Shows which druids cast Innervate on whom.
 * Spell ID: 29166
 */

import type { PanelProcessor, AuraCastProcessorEvent, ProcessorContext } from "../processorTypes";
import type { StreamType } from "@/hooks/instanceEvents";

/** Innervate spell ID */
const INNERVATE_SPELL_ID = 29166;

/** A single Innervate cast */
export interface InnervateCast {
  /** Timestamp in milliseconds since epoch (serializable through worker) */
  timestampMs: number;
  /** GUID of the druid who cast */
  casterGuid: string;
  /** Name of the druid who cast */
  casterName: string;
  /** GUID of the target */
  targetGuid: string;
  /** Name of the target */
  targetName: string;
  /** Encounter ID this cast occurred in */
  encounterId: string;
}

/** Result type for the Innervate processor */
export interface InnervateResult {
  /** All Innervate casts, in chronological order */
  casts: InnervateCast[];
}

/**
 * Innervate processor implementation.
 */
export const innervateProcessor: PanelProcessor<InnervateResult, AuraCastProcessorEvent> = {
  id: "innervate",
  streams: ["aura_cast"] as StreamType[],
  
  createState: (): InnervateResult => ({
    casts: [],
  }),
  
  processEvent: (
    state: InnervateResult,
    event: AuraCastProcessorEvent,
    encounterID: string,
    firstTimestamp: Date,
    _streamType: StreamType,
    context: ProcessorContext,
  ): void => {
    // Only process aura_cast events for Innervate
    if (event.type !== "aura_cast") return;
    if (event.spell.id !== INNERVATE_SPELL_ID) return;
    if (!context.selectedEncounterIds.has(encounterID)) return;
    
    // Get player names from context
    const casterPlayer = context.players[event.caster];
    const targetPlayer = event.target ? context.players[event.target] : null;
    
    // Use firstTimestamp.getTime() to get ms (number serializes through worker, Date doesn't)
    const timestampMs = firstTimestamp.getTime() + event.offsetMilli;
    
    state.casts.push({
      timestampMs,
      casterGuid: event.caster,
      casterName: casterPlayer?.name ?? event.caster,
      targetGuid: event.target ?? event.caster,  // Self-cast if no target
      targetName: targetPlayer?.name ?? event.target ?? casterPlayer?.name ?? event.caster,
      encounterId: encounterID,
    });
  },
};
