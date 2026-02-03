/**
 * Judgement processor - Tracks Paladin Judgement usage and uptime.
 * 
 * Tracks:
 * - Which paladins judged which targets
 * - Judgement type (Light, Wisdom, Crusader, Justice)
 * - Uptime of each judgement debuff on targets
 * - Benefit from Judgement of Light (healing) and Wisdom (mana)
 * 
 * Log format:
 * - Cast: "Dymphna casts Judgement on Onyxia" (spell ID 20271)
 * - Affliction: "Onyxia is afflicted by Judgement of Light (1)"
 * - Heal: "Judgement of Light heals Player for 61"
 * - Fade: "Judgement of Light fades from Onyxia"
 */

import type { PanelProcessor, ProcessorContext, CastProcessorEvent, AuraProcessorEvent, HealProcessorEvent, SlainProcessorEvent } from "../processorTypes";
import { AuraApplication } from "../processorTypes";
import type { StreamType } from "@/hooks/instanceEvents";

/** Judgement spell ID (the cast is always "Judgement", type determined by aura) */
const JUDGEMENT_SPELL_ID = 20271;

/** Time window to match a Judgement cast with its affliction event (ms) */
const MATCH_WINDOW_MS = 500;

/** Judgement types */
export type JudgementType = "light" | "wisdom" | "crusader" | "justice" | "unknown";

/** Map spell names to judgement types */
const JUDGEMENT_TYPE_MAP: Record<string, JudgementType> = {
  "Judgement of Light": "light",
  "Judgement of Wisdom": "wisdom",
  "Judgement of the Crusader": "crusader",
  "Judgement of Justice": "justice",
};

/** A pending judgement cast waiting to be matched with an affliction */
interface PendingJudgement {
  casterGuid: string;
  casterName: string;
  targetGuid: string;
  targetName: string;
  offsetMs: number;
  encounterId: string;
}

/** A pending aura event waiting to be matched with a cast (for out-of-order events) */
interface PendingAura {
  type: JudgementType;
  targetGuid: string;
  targetName: string;
  offsetMs: number;
  encounterId: string;
}

/** An active judgement debuff on a target */
interface ActiveJudgement {
  type: JudgementType;
  casterGuid: string;
  casterName: string;
  targetGuid: string;
  targetName: string;
  startOffsetMs: number;
  encounterId: string;
}

/** A completed judgement application (matched cast + affliction, possibly faded) */
export interface JudgementApplication {
  type: JudgementType;
  casterGuid: string;
  casterName: string;
  targetGuid: string;
  targetName: string;
  startOffsetMs: number;
  endOffsetMs: number | null; // null if still active at end of encounter
  encounterId: string;
}

/** Stats for a single paladin */
export interface PaladinJudgementStats {
  guid: string;
  name: string;
  /** Count of each judgement type cast */
  byType: Record<JudgementType, number>;
  /** Total judgements cast */
  totalJudgements: number;
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
  /** Stats per paladin (keyed by guid) */
  paladins: Record<string, PaladinJudgementStats>;
  /** Stats per target (keyed by guid) */
  targets: Record<string, TargetJudgementStats>;
  /** Benefit tracking for JoL */
  jolBenefit: JudgementOfLightBenefit;
  /** Total mana restored by JoW (if trackable) */
  jowManaRestored: number;
  
  // Internal state (not for display)
  /** Pending casts waiting for affliction match (keyed by targetGuid) */
  _pendingCasts: Map<string, PendingJudgement[]>;
  /** Pending auras waiting for cast match - handles out-of-order events (keyed by targetGuid) */
  _pendingAuras: Map<string, PendingAura[]>;
  /** Currently active judgements (keyed by targetGuid + type) */
  _activeJudgements: Map<string, ActiveJudgement>;
  /** Track encounter end times for uptime calculation */
  _encounterMaxOffset: Map<string, number>;
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

/** Initialize paladin stats */
function initPaladinStats(guid: string, name: string): PaladinJudgementStats {
  return {
    guid,
    name,
    byType: { light: 0, wisdom: 0, crusader: 0, justice: 0, unknown: 0 },
    totalJudgements: 0,
  };
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
 * Flush expired pending casts and auras (older than MATCH_WINDOW_MS).
 * These are judgements that never got matched.
 */
function flushExpiredPending(state: JudgementResult, currentOffsetMs: number, encounterId: string): void {
  // Flush expired pending casts
  for (const [targetGuid, pending] of state._pendingCasts.entries()) {
    const validCasts = pending.filter(p => {
      if (p.encounterId !== encounterId) return true; // Keep casts from other encounters
      return currentOffsetMs - p.offsetMs < MATCH_WINDOW_MS;
    });
    if (validCasts.length === 0) {
      state._pendingCasts.delete(targetGuid);
    } else if (validCasts.length !== pending.length) {
      state._pendingCasts.set(targetGuid, validCasts);
    }
  }
  
  // Flush expired pending auras
  for (const [targetGuid, pending] of state._pendingAuras.entries()) {
    const validAuras = pending.filter(p => {
      if (p.encounterId !== encounterId) return true;
      return currentOffsetMs - p.offsetMs < MATCH_WINDOW_MS;
    });
    if (validAuras.length === 0) {
      state._pendingAuras.delete(targetGuid);
    } else if (validAuras.length !== pending.length) {
      state._pendingAuras.set(targetGuid, validAuras);
    }
  }
}

/**
 * Finalize all active judgements on a target when it dies.
 */
function finalizeJudgementsOnTarget(state: JudgementResult, targetGuid: string, endOffsetMs: number): void {
  // Find all active judgements on this target
  const keysToRemove: string[] = [];
  
  for (const [key, active] of state._activeJudgements.entries()) {
    if (active.targetGuid !== targetGuid) continue;
    
    finalizeActiveJudgement(state, active, endOffsetMs);
    keysToRemove.push(key);
  }
  
  for (const key of keysToRemove) {
    state._activeJudgements.delete(key);
  }
}

type JudgementEvent = CastProcessorEvent | AuraProcessorEvent | HealProcessorEvent | SlainProcessorEvent;

/**
 * Judgement processor implementation.
 */
export const judgementProcessor: PanelProcessor<JudgementResult, JudgementEvent> = {
  id: "judgement",
  streams: ["cast", "aura", "heal", "slain"] as StreamType[],
  
  createState: (): JudgementResult => ({
    paladins: {},
    targets: {},
    jolBenefit: {
      totalHealing: 0,
      byPlayer: new Map(),
    },
    jowManaRestored: 0,
    _pendingCasts: new Map(),
    _pendingAuras: new Map(),
    _activeJudgements: new Map(),
    _encounterMaxOffset: new Map(),
  }),
  
  processEvent: (
    state: JudgementResult,
    event: JudgementEvent,
    encounterID: string,
    firstTimestamp: Date,
    _streamType: StreamType,
    context: ProcessorContext,
  ): void => {
    if (!context.selectedEncounterIds.has(encounterID)) return;
    
    // Track max offset per encounter for uptime finalization
    const currentMax = state._encounterMaxOffset.get(encounterID) ?? 0;
    if (event.offsetMilli > currentMax) {
      state._encounterMaxOffset.set(encounterID, event.offsetMilli);
    }
    
    // Flush expired pending casts
    flushExpiredPending(state, event.offsetMilli, encounterID);
    
    if (event.type === "cast") {
      processCastEvent(state, event, encounterID, context);
    } else if (event.type === "aura") {
      processAuraEvent(state, event, encounterID, context);
    } else if (event.type === "heal") {
      processHealEvent(state, event, context);
    } else if (event.type === "slain") {
      processSlainEvent(state, event);
    }
  },
};

function processCastEvent(
  state: JudgementResult,
  event: CastProcessorEvent,
  encounterID: string,
  context: ProcessorContext,
): void {
  // Only track Judgement casts
  if (event.spell.id !== JUDGEMENT_SPELL_ID) return;
  if (event.action !== 1) return; // Only successful casts
  
  const casterPlayer = context.players[event.caster];
  const casterName = casterPlayer?.name ?? event.caster;
  const targetName = context.units?.[event.target]?.name ?? context.players[event.target]?.name ?? event.target;
  
  // Check if there's a pending aura that arrived before this cast (out-of-order events)
  const pendingAuras = state._pendingAuras.get(event.target) ?? [];
  const auraMatchIndex = pendingAuras.findIndex(a =>
    a.encounterId === encounterID &&
    event.offsetMilli - a.offsetMs >= 0 &&
    event.offsetMilli - a.offsetMs < MATCH_WINDOW_MS
  );
  
  if (auraMatchIndex >= 0) {
    // Found a matching aura that came before the cast - credit this paladin
    const matchedAura = pendingAuras[auraMatchIndex];
    
    // Remove from pending auras
    pendingAuras.splice(auraMatchIndex, 1);
    if (pendingAuras.length === 0) {
      state._pendingAuras.delete(event.target);
    }
    
    // Update paladin stats
    let paladinStats = state.paladins[event.caster];
    if (!paladinStats) {
      paladinStats = initPaladinStats(event.caster, casterName);
      state.paladins[event.caster] = paladinStats;
    }
    paladinStats.byType[matchedAura.type]++;
    paladinStats.totalJudgements++;
    
    // Update the active judgement to credit this paladin
    const key = activeKey(event.target, matchedAura.type);
    const active = state._activeJudgements.get(key);
    if (active && active.casterGuid === "unknown") {
      active.casterGuid = event.caster;
      active.casterName = casterName;
    }
    
    return; // Don't store as pending cast since we already matched
  }
  
  // Store as pending cast (waiting for affliction event)
  const pending: PendingJudgement = {
    casterGuid: event.caster,
    casterName,
    targetGuid: event.target,
    targetName,
    offsetMs: event.offsetMilli,
    encounterId: encounterID,
  };
  
  const existing = state._pendingCasts.get(event.target) ?? [];
  existing.push(pending);
  state._pendingCasts.set(event.target, existing);
}

function processAuraEvent(
  state: JudgementResult,
  event: AuraProcessorEvent,
  encounterID: string,
  context: ProcessorContext,
): void {
  const judgementType = parseJudgementType(event.spellName);
  if (!judgementType) return;
  
  const key = activeKey(event.target, judgementType);
  
  if (event.application === AuraApplication.Gains) {
    // Try to match with a pending cast
    const pendingList = state._pendingCasts.get(event.target) ?? [];
    const matchIndex = pendingList.findIndex(p => 
      p.encounterId === encounterID &&
      event.offsetMilli - p.offsetMs >= 0 &&
      event.offsetMilli - p.offsetMs < MATCH_WINDOW_MS
    );
    
    let casterGuid: string;
    let casterName: string;
    
    if (matchIndex >= 0) {
      // Found a matching cast - credit that paladin
      const matched = pendingList[matchIndex];
      casterGuid = matched.casterGuid;
      casterName = matched.casterName;
      
      // Remove from pending
      pendingList.splice(matchIndex, 1);
      if (pendingList.length === 0) {
        state._pendingCasts.delete(event.target);
      }
      
      // Update paladin stats
      let paladinStats = state.paladins[casterGuid];
      if (!paladinStats) {
        paladinStats = initPaladinStats(casterGuid, casterName);
        state.paladins[casterGuid] = paladinStats;
      }
      paladinStats.byType[judgementType]++;
      paladinStats.totalJudgements++;
    } else {
      // No matching cast found - store as pending aura in case cast arrives later
      // (out-of-order events due to stream interleaving)
      casterGuid = "unknown";
      casterName = "Unknown";
      
      const targetName = context.units?.[event.target]?.name ?? context.players[event.target]?.name ?? event.target;
      const pendingAura: PendingAura = {
        type: judgementType,
        targetGuid: event.target,
        targetName,
        offsetMs: event.offsetMilli,
        encounterId: encounterID,
      };
      const existingAuras = state._pendingAuras.get(event.target) ?? [];
      existingAuras.push(pendingAura);
      state._pendingAuras.set(event.target, existingAuras);
    }
    
    // If there's an existing active judgement of this type, finalize it first
    const existingActive = state._activeJudgements.get(key);
    if (existingActive) {
      finalizeActiveJudgement(state, existingActive, event.offsetMilli);
    }
    
    // Start tracking the new active judgement
    const targetName = context.units?.[event.target]?.name ?? context.players[event.target]?.name ?? event.target;
    const active: ActiveJudgement = {
      type: judgementType,
      casterGuid,
      casterName,
      targetGuid: event.target,
      targetName,
      startOffsetMs: event.offsetMilli,
      encounterId: encounterID,
    };
    state._activeJudgements.set(key, active);
    
  } else if (event.application === AuraApplication.Fades || event.application === AuraApplication.Removed) {
    // Judgement faded - finalize uptime
    const active = state._activeJudgements.get(key);
    if (active) {
      finalizeActiveJudgement(state, active, event.offsetMilli);
      state._activeJudgements.delete(key);
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
    casterGuid: active.casterGuid,
    casterName: active.casterName,
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
  _context: ProcessorContext,
): void {
  // Check if this is a Judgement of Light heal
  // The sourceName should be "Judgement of Light"
  if (event.sourceName !== "Judgement of Light") return;
  
  // Only count JoL heals if we have an active JoL on some target
  // This filters out heals from JoL that was applied before the encounter started
  let hasActiveJoL = false;
  for (const [key] of state._activeJudgements) {
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
  // This handles the case where judgements are still active when the boss dies
  finalizeJudgementsOnTarget(state, event.target, event.offsetMilli);
}
