/**
 * Mitigation processor - tracks damage prevented through absorbs, resists, and blocks.
 * 
 * TODO: Coming soon - will use tailers on damage events:
 * - "(15 absorbed)" -> HitTypePartialAbsorb
 * - "(4 resisted)" -> HitTypePartialResist  
 * - "(10 blocked)" -> HitTypePartialBlock
 */

import type { DamageProcessorEvent, PanelProcessor } from "../processorTypes";

/**
 * Mitigation breakdown by type for a single player.
 */
export interface MitigationData {
  playerID: string;
  playerName: string;
  className: string;
  absorbed: number;
  resisted: number;
  blocked: number;
  total: number;
}

// Map of playerID -> MitigationData per encounter
export type EncounterMitigation = Map<string, MitigationData>;

export type MitigationResult = {
  // Placeholder - no data yet
  _placeholder: boolean;
};

/**
 * Create the mitigation processor (stub - coming soon).
 */
export function createMitigationProcessor(): PanelProcessor<MitigationResult, DamageProcessorEvent> {
  return {
    id: "mitigation",
    streams: ["damage"],

    createState: () => ({
      _placeholder: true,
    }),

    processEvent: () => {
      // Coming soon - no processing yet
    },
  };
}

// Pre-created processor for registry
export const mitigationProcessor = createMitigationProcessor();
