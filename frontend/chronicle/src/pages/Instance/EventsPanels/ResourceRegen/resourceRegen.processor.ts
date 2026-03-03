/**
 * Resource Regeneration processor - aggregates resource gains/losses by player
 * 
 * Tracks Mana, Rage, Energy, Health, Happiness, and Focus gains from abilities.
 */

import type { PanelProcessor, ProcessorContext, ResourceChangeProcessorEvent } from "../processorTypes";
import type { StreamType } from "@/hooks/instanceEvents";

/**
 * Resource types from WoW combat log
 */
export type ResourceType = "Health" | "Mana" | "Rage" | "Happiness" | "Energy" | "Focus";

/**
 * All resource types for iteration
 */
export const ALL_RESOURCE_TYPES: ResourceType[] = ["Mana", "Rage", "Energy", "Health", "Happiness", "Focus"];

/**
 * Data for a single ability's resource contribution
 */
export interface ResourceAbilityData {
  abilityName: string;
  gained: number;
  lost: number;
  /** Number of gain events (procs/ticks) */
  gainCount: number;
  /** Number of loss events */
  lossCount: number;
}

/**
 * Per-player resource data for a specific resource type
 */
export interface PlayerResourceData {
  playerID: string;
  playerName: string;
  className: string;
  /** Total gained across all abilities */
  totalGained: number;
  /** Total lost across all abilities */
  totalLost: number;
  /** Breakdown by ability name */
  byAbility: Map<string, ResourceAbilityData>;
  /** Breakdown by source player (who gave the resource) */
  bySource: Map<string, number>;
}

/**
 * Per-encounter resource data
 * Map of playerID -> ResourceType -> PlayerResourceData
 */
export type EncounterResourceData = Map<string, Map<ResourceType, PlayerResourceData>>;

/**
 * Result state for resource regeneration processor
 */
export interface ResourceRegenResult {
  /** Encounter ID -> player resource data */
  encounterData: Map<string, EncounterResourceData>;
}

/**
 * Create initial player resource data
 */
function createPlayerResourceData(
  playerID: string,
  playerName: string,
  className: string
): PlayerResourceData {
  return {
    playerID,
    playerName,
    className,
    totalGained: 0,
    totalLost: 0,
    byAbility: new Map(),
    bySource: new Map(),
  };
}

export const resourceRegenProcessor: PanelProcessor<ResourceRegenResult, ResourceChangeProcessorEvent> = {
  id: "resource_regen",
  streams: ["resource_change"] as StreamType[],

  createState: () => ({
    encounterData: new Map<string, EncounterResourceData>(),
  }),

  processEvent: (
    state: ResourceRegenResult,
    event: ResourceChangeProcessorEvent,
    encounterID: string,
    _firstTimestamp: Date,
    _streamType: StreamType,
    context: ProcessorContext
  ) => {
    // Only process if this encounter is selected
    if (!context.selectedEncounterIds.has(encounterID)) {
      return;
    }

    // Get or create encounter data
    if (!state.encounterData.has(encounterID)) {
      state.encounterData.set(encounterID, new Map());
    }
    const encounterData = state.encounterData.get(encounterID)!;

    // Get target player info
    const targetPlayer = context.players[event.target];
    if (!targetPlayer) {
      // Skip non-player targets (pets, etc.)
      return;
    }

    // Filter by selected players if any are selected
    const { entitySelection } = context;
    if (entitySelection.playerIds.size > 0 && !entitySelection.playerIds.has(event.target)) {
      return;
    }

    // Get resource type from event
    const resourceType = event.resourceType as ResourceType;
    if (!ALL_RESOURCE_TYPES.includes(resourceType)) {
      return;
    }

    // Get or create player's resource map
    if (!encounterData.has(event.target)) {
      encounterData.set(event.target, new Map());
    }
    const playerResources = encounterData.get(event.target)!;

    // Get or create resource data for this type
    if (!playerResources.has(resourceType)) {
      playerResources.set(
        resourceType,
        createPlayerResourceData(event.target, targetPlayer.name, targetPlayer.class)
      );
    }
    const resourceData = playerResources.get(resourceType)!;

    // Rage values are encoded in tenths in combat logs, so normalize to player-visible units.
    const normalizedAmount = resourceType === "Rage" ? event.amount / 10 : event.amount;

    // Update totals based on direction
    const isGain = event.direction === "Gain";
    if (isGain) {
      resourceData.totalGained += normalizedAmount;
    } else {
      resourceData.totalLost += normalizedAmount;
    }

    // Update ability breakdown
    const abilityName = event.sourceName || "Unknown";
    if (!resourceData.byAbility.has(abilityName)) {
      resourceData.byAbility.set(abilityName, {
        abilityName,
        gained: 0,
        lost: 0,
        gainCount: 0,
        lossCount: 0,
      });
    }
    const abilityData = resourceData.byAbility.get(abilityName)!;
    if (isGain) {
      abilityData.gained += normalizedAmount;
      abilityData.gainCount += 1;
    } else {
      abilityData.lost += normalizedAmount;
      abilityData.lossCount += 1;
    }

    // Update source breakdown (who provided the resource)
    const sourcePlayer = context.players[event.caster];
    const sourceName = sourcePlayer?.name || event.caster || "Self";
    if (isGain) {
      resourceData.bySource.set(
        sourceName,
        (resourceData.bySource.get(sourceName) || 0) + normalizedAmount
      );
    }
  },
};
