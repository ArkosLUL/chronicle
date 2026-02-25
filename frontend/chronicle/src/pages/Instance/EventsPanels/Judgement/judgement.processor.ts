/**
 * Judgement processor - Tracks Paladin Judgement uptime on targets.
 * 
 * Tracks:
 * - Judgement type (Light, Wisdom, Crusader, Justice)
 * - Uptime of each judgement debuff on targets
 * - Benefit from Judgement of Light (healing)
 * 
 * Log format:
 * - Affliction: "Onyxia is afflicted by Judgement of Light (1)"
 * - Heal: "Judgement of Light heals Player for 61"
 * - Fade: "Judgement of Light fades from Onyxia"
 * - Slain: Target dies (treated as fade for uptime)
 */

import type { PanelProcessor, ProcessorContext, AuraProcessorEvent, HealProcessorEvent, SlainProcessorEvent } from "../processorTypes";
import { AuraState } from "../processorTypes";
import type { StreamType } from "@/hooks/instanceEvents";

/** Judgement types */
export type JudgementType = "light" | "wisdom" | "crusader" | "justice" | "unknown";

/** Map spell names to judgement types */
const JUDGEMENT_TYPE_MAP: Record<string, JudgementType> = {
  "Judgement of Light": "light",
  "Judgement of Wisdom": "wisdom",
  "Judgement of the Crusader": "crusader",
  "Judgement of Justice": "justice",
};

/** An active judgement debuff on a target */
interface ActiveJudgement {
  type: JudgementType;
  targetGuid: string;
  targetName: string;
  startOffsetMs: number;
  encounterId: string;
}

/** A completed judgement application */
export interface JudgementApplication {
  type: JudgementType;
  targetGuid: string;
  targetName: string;
  startOffsetMs: number;
  endOffsetMs: number;
  encounterId: string;
}

/** Stats for a single target */
export interface TargetJudgementStats {
  guid: string;
  name: string;
  /** Uptime in ms for each judgement type */
  uptimeByType: Record<JudgementType, number>;
  /** Total uptime across all types (not deduplicated - can overlap) */
  totalUptimeMs: number;
  /** All judgement applications on this target */
  applications: JudgementApplication[];
}

/** Benefit tracking for Judgement of Light */
export interface JudgementOfLightBenefit {
  /** Total healing done by JoL procs */
  totalHealing: number;
  /** Healing received per player guid */
  byPlayer: Map<string, number>;
}

/** Result type for the Judgement processor */
export interface JudgementResult {
  /** Stats per target (keyed by guid) */
  targets: Record<string, TargetJudgementStats>;
  /** Benefit tracking for JoL */
  jolBenefit: JudgementOfLightBenefit;
  /** Currently active judgements - exported for UI to show still-active debuffs */
  activeJudgements: Map<string, ActiveJudgement>;
  /** Max event offset seen per encounter - used to calculate active judgement uptime */
  maxOffsetByEncounter: Map<string, number>;
  /** Last encounter ID processed - used to detect encounter transitions */
  lastEncounterId: string | null;
}

/** Create a composite key for active judgements */
function activeKey(targetGuid: string, type: JudgementType): string {
  return `${targetGuid}:${type}`;
}

/** Parse judgement type from aura spell name */
function parseJudgementType(spellName: string): JudgementType | null {
  for (const [name, type] of Object.entries(JUDGEMENT_TYPE_MAP)) {
    if (spellName.startsWith(name)) {
      return type;
    }
  }
  return null;
}

/** Initialize target stats */
function initTargetStats(guid: string, name: string): TargetJudgementStats {
  return {
    guid,
    name,
    uptimeByType: { light: 0, wisdom: 0, crusader: 0, justice: 0, unknown: 0 },
    totalUptimeMs: 0,
    applications: [],
  };
}

/**
 * Finalize all active judgements on a target (when it dies).
 */
function finalizeJudgementsOnTarget(state: JudgementResult, targetGuid: string, endOffsetMs: number): void {
  const keysToRemove: string[] = [];
  
  for (const [key, active] of state.activeJudgements) {
    if (active.targetGuid !== targetGuid) continue;
    
    finalizeActiveJudgement(state, active, endOffsetMs);
    keysToRemove.push(key);
  }
  
  for (const key of keysToRemove) {
    state.activeJudgements.delete(key);
  }
}

/**
 * Finalize all active judgements for an encounter (when encounter ends).
 * Uses the max offset for each judgement's encounter as the end time.
 */
function finalizeAllActiveJudgements(state: JudgementResult): void {
  for (const [, active] of state.activeJudgements) {
    const endOffsetMs = state.maxOffsetByEncounter.get(active.encounterId) ?? active.startOffsetMs;
    finalizeActiveJudgement(state, active, endOffsetMs);
  }
  state.activeJudgements.clear();
}

type JudgementEvent = AuraProcessorEvent | HealProcessorEvent | SlainProcessorEvent;

/**
 * Judgement processor implementation.
 */
export const judgementProcessor: PanelProcessor<JudgementResult, JudgementEvent> = {
  id: "judgement",
  streams: ["aura", "heal", "slain"] as StreamType[],
  
  createState: (): JudgementResult => ({
    targets: {},
    jolBenefit: {
      totalHealing: 0,
      byPlayer: new Map(),
    },
    activeJudgements: new Map(),
    maxOffsetByEncounter: new Map(),
    lastEncounterId: null,
  }),
  
  processEvent: (
    state: JudgementResult,
    event: JudgementEvent,
    encounterID: string,
    _firstTimestamp: Date,
    _streamType: StreamType,
    context: ProcessorContext,
  ): void => {
    // Detect encounter transition - finalize all active judgements from previous encounter
    if (state.lastEncounterId !== null && state.lastEncounterId !== encounterID) {
      finalizeAllActiveJudgements(state);
    }
    state.lastEncounterId = encounterID;

    if (!context.selectedEncounterIds.has(encounterID)) return;
    
    // Track max offset per encounter for calculating active judgement uptime
    const currentMax = state.maxOffsetByEncounter.get(encounterID) ?? 0;
    if (event.offsetMilli > currentMax) {
      state.maxOffsetByEncounter.set(encounterID, event.offsetMilli);
    }
    
    if (event.type === "aura") {
      processAuraEvent(state, event, encounterID, context);
    } else if (event.type === "heal") {
      processHealEvent(state, event);
    } else if (event.type === "slain") {
      processSlainEvent(state, event);
    }
  },
};

function processAuraEvent(
  state: JudgementResult,
  event: AuraProcessorEvent,
  encounterID: string,
  context: ProcessorContext,
): void {
  const judgementType = parseJudgementType(event.spellName);
  if (!judgementType) return;
  
  // Filter by selected enemies if any are selected
  if (context.entitySelection.enemyIds.size > 0) {
    if (!context.entitySelection.enemyIds.has(event.target)) return;
  }
  
  const key = activeKey(event.target, judgementType);
  
  if (event.state === AuraState.Added) {
    // If there's an existing active judgement of this type, finalize it first
    const existingActive = state.activeJudgements.get(key);
    if (existingActive) {
      finalizeActiveJudgement(state, existingActive, event.offsetMilli);
    }
    
    // Start tracking the new active judgement
    const targetName = context.units?.[event.target]?.name ?? context.players[event.target]?.name ?? event.target;
    const active: ActiveJudgement = {
      type: judgementType,
      targetGuid: event.target,
      targetName,
      startOffsetMs: event.offsetMilli,
      encounterId: encounterID,
    };
    state.activeJudgements.set(key, active);
    
  } else if (event.state === AuraState.Removed) {
    // Judgement faded - finalize uptime
    const active = state.activeJudgements.get(key);
    if (active) {
      finalizeActiveJudgement(state, active, event.offsetMilli);
      state.activeJudgements.delete(key);
    }
  }
}

function finalizeActiveJudgement(
  state: JudgementResult,
  active: ActiveJudgement,
  endOffsetMs: number,
): void {
  const uptimeMs = endOffsetMs - active.startOffsetMs;
  if (uptimeMs <= 0) return;
  
  // Get or create target stats
  let targetStats = state.targets[active.targetGuid];
  if (!targetStats) {
    targetStats = initTargetStats(active.targetGuid, active.targetName);
    state.targets[active.targetGuid] = targetStats;
  }
  
  // Record the application
  const application: JudgementApplication = {
    type: active.type,
    targetGuid: active.targetGuid,
    targetName: active.targetName,
    startOffsetMs: active.startOffsetMs,
    endOffsetMs,
    encounterId: active.encounterId,
  };
  targetStats.applications.push(application);
  targetStats.uptimeByType[active.type] += uptimeMs;
  targetStats.totalUptimeMs += uptimeMs;
}

function processHealEvent(
  state: JudgementResult,
  event: HealProcessorEvent,
): void {
  // Check if this is a Judgement of Light heal
  if (event.sourceName !== "Judgement of Light") return;
  
  // Only count JoL heals if we have an active JoL on some target
  let hasActiveJoL = false;
  for (const [key] of state.activeJudgements) {
    if (key.endsWith(":light")) {
      hasActiveJoL = true;
      break;
    }
  }
  if (!hasActiveJoL) return;
  
  state.jolBenefit.totalHealing += event.amount;
  
  // Track per-player benefit
  const current = state.jolBenefit.byPlayer.get(event.target) ?? 0;
  state.jolBenefit.byPlayer.set(event.target, current + event.amount);
}

function processSlainEvent(
  state: JudgementResult,
  event: SlainProcessorEvent,
): void {
  // When a target dies, finalize any active judgements on it
  finalizeJudgementsOnTarget(state, event.target, event.offsetMilli);
}
