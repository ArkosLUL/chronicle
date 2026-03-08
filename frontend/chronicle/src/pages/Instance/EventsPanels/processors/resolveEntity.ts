/**
 * Shared entity display resolution for PlayerMetricChart rows.
 * Replaces the duplicated GUID → {name, class} if/else chains across processors.
 *
 * Two orthogonal axes control behaviour:
 *   - EntityGrouping: how to bucket rows (by player, by class, by name)
 *   - PetMode:        how to handle pet entities (with owner, individual, by name)
 *
 * Pure TypeScript, worker-safe. No React.
 */

import { isPlayerGuidFast } from "./guidCache";
import type { ProcessorContext } from "../processorTypes";

export interface EntityDisplay {
  /** Bucketing key — may differ from input GUID (e.g. owner GUID for pets in "owner" mode) */
  id: string;
  name: string;
  class: string;
}

/** A single option shown in the panel settings UI toggle group. */
export interface GroupingOption {
  /** Serialized value stored in panelOption token */
  value: string;
  /** Display label (e.g. "By Owner", "By Class") */
  label: string;
}

/** How to bucket entities into rows. */
export type EntityGrouping = "default" | "class" | "name";

/** How to handle pet entities. */
export type PetMode = "owner" | "individual" | "name";

/**
 * Resolve a GUID to display info for PlayerMetricChart rows.
 *
 * @param guid     - Raw GUID from the event (caster or target)
 * @param context  - ProcessorContext with players and units maps
 * @param grouping - Entity bucketing mode:
 *   - "default": each entity gets its own row
 *   - "class":   group by class
 *   - "name":    dedup same-named entities into one row
 * @param pets     - Pet handling mode:
 *   - "owner":      merge pet damage into owner's row (default)
 *   - "individual": each pet instance gets its own row
 *   - "name":       pets deduped by name per owner
 */
export function resolveEntity(
  guid: string,
  context: ProcessorContext,
  grouping: EntityGrouping = "default",
  pets: PetMode = "owner",
): EntityDisplay {
  // Player
  if (isPlayerGuidFast(guid)) {
    const p = context.players[guid];
    if (grouping === "class") {
      const cls = p?.class || "UNKNOWN";
      return {
        id: `class:${cls}`,
        name: cls.charAt(0) + cls.slice(1).toLowerCase(),
        class: cls,
      };
    }
    return {
      id: guid,
      name: p?.name || guid,
      class: p?.class || "UNKNOWN",
    };
  }

  // Pet (has an owner)
  const unit = context.units?.[guid];
  if (unit?.owner) {
    const ownerName = context.players[unit.owner]?.name || "Unknown";
    const ownerClass = context.players[unit.owner]?.class || "UNKNOWN";
    const petName = unit.name || guid;

    if (pets === "individual") {
      return {
        id: guid,
        name: `${petName} (${ownerName})`,
        class: ownerClass,
      };
    }
    if (pets === "name") {
      return {
        id: `pet_name:${petName.toLowerCase()}:${unit.owner}`,
        name: `${petName} (${ownerName})`,
        class: ownerClass,
      };
    }
    // pets === "owner" — group under owner
    // If grouping is "class", bucket under the owner's class instead
    if (grouping === "class") {
      return {
        id: `class:${ownerClass}`,
        name: ownerClass.charAt(0) + ownerClass.slice(1).toLowerCase(),
        class: ownerClass,
      };
    }
    return {
      id: unit.owner,
      name: `${ownerName}'s Companions`,
      class: ownerClass,
    };
  }

  // Enemy / unknown
  const enemyName = unit?.name || guid;
  if (grouping === "name") {
    return {
      id: `enemy_name:${enemyName.toLowerCase()}`,
      name: enemyName,
      class: "ENEMY",
    };
  }
  if (grouping === "class") {
    return {
      id: `class:ENEMY`,
      name: "Enemy",
      class: "ENEMY",
    };
  }
  return {
    id: guid,
    name: enemyName,
    class: "ENEMY",
  };
}

// ---------------------------------------------------------------------------
// Built-in option sets for panels to declare
// ---------------------------------------------------------------------------

/** Entity-level grouping options. */
export const ENTITY_GROUPING_OPTIONS: GroupingOption[] = [
  { value: "default", label: "ID" },
  { value: "class", label: "Class" },
  { value: "name", label: "Name" },
];

/** Pet handling options. */
export const PET_MODE_OPTIONS: GroupingOption[] = [
  { value: "owner", label: "With Owner" },
  { value: "individual", label: "Individual" },
  { value: "name", label: "Name" },
];

// ---------------------------------------------------------------------------
// panelOption token extraction helpers
// ---------------------------------------------------------------------------

/**
 * Extract the entity grouping value from a panelOption string.
 * Looks for a "g:<value>" token.
 */
export function extractGroupingFromPanelOption(panelOption: string | null | undefined): EntityGrouping {
  if (!panelOption) return "default";
  const token = panelOption.split(",").find((t) => t.startsWith("g:"));
  return (token ? token.slice(2) : "default") as EntityGrouping;
}

/**
 * Extract the pet mode value from a panelOption string.
 * Looks for a "p:<value>" token.
 */
export function extractPetModeFromPanelOption(panelOption: string | null | undefined): PetMode {
  if (!panelOption) return "owner";
  const token = panelOption.split(",").find((t) => t.startsWith("p:"));
  return (token ? token.slice(2) : "owner") as PetMode;
}
