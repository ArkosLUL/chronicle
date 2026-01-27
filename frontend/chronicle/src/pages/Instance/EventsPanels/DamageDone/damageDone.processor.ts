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


// UnitDamage is unit guid -> DamageDoneData
export type UnitDamage = Map<string, DamageDoneData>;


export type DamageDoneResult = {
  EncounterDamage: Map<string, UnitDamage>;
  Random: number;
}

export const damageDoneProcessor: PanelProcessor<DamageDoneResult> = {
  id: "damage_done",
  streams: ["damage"],

  createState: () => ({
    EncounterDamage: new Map<string, UnitDamage>(),
    Random: Math.random(),
  }),

  processEvent: (
    state: DamageDoneResult,
    event: ProcessorEvent,
    encounterID: string,
    streamType: string,
    context: ProcessorContext
  ) => {
    // Only process damage events
    if (streamType !== "damage") return;
    if (!event.caster) return;

    let damageOwner = event.caster;
    if (!GUID.fromString(event.caster).isPlayer()) {
      const unit = context.units?.[event.caster];
      if(unit && unit.owner && GUID.fromString(unit.owner).isPlayer()) {
        damageOwner = unit.owner;
      }
      return;
    }

    if (!state.EncounterDamage.has(encounterID)) {
      state.EncounterDamage.set(encounterID, new Map<string, DamageDoneData>());
    }
    const encounterDamage = state.EncounterDamage.get(encounterID)!;
    const existing = encounterDamage.get(damageOwner) || {
      playerID: damageOwner,
      value: 0,
      playerName: context.players[damageOwner]?.name || "",
      className: context.players[damageOwner]?.class || "UNKNOWN",
      specialization: "",
    };

    existing.value += event.amount;
    encounterDamage.set(damageOwner, existing);
    state.EncounterDamage.set(encounterID, encounterDamage);
  },
};
