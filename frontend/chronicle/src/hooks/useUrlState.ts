/**
 * Hook to sync state with URL search params.
 * Allows state to persist across page refreshes and be shareable via URL.
 */

import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

type Serializer<T> = {
  serialize: (value: T) => string | null;
  deserialize: (value: string | null, defaultValue: T) => T;
};

// Built-in serializers for common types
const stringSerializer: Serializer<string> = {
  serialize: (v) => v || null,
  deserialize: (v, d) => v ?? d,
};

const stringArraySerializer: Serializer<string[]> = {
  serialize: (v) => (v.length > 0 ? v.join(",") : null),
  deserialize: (v, d) => (v ? v.split(",").filter(Boolean) : d),
};

const stringSetSerializer: Serializer<Set<string>> = {
  serialize: (v) => (v.size > 0 ? Array.from(v).join(",") : null),
  deserialize: (v, d) => (v ? new Set(v.split(",").filter(Boolean)) : d),
};

/**
 * Create a serializer that stores array indices instead of full IDs.
 * Much more compact for URLs when IDs are long (e.g., GUIDs).
 * 
 * @param items - Array of items with an id property (order must be stable!)
 * @returns Serializer that converts between string[] IDs and compact index string
 * 
 * @example
 * // URL: ?encounters=0,2,5 instead of ?encounters=uuid1,uuid2,uuid3
 * const serializer = createIndexedArraySerializer(encounters);
 */
function createIndexedArraySerializer<T extends { id: string }>(
  items: readonly T[]
): Serializer<string[]> {
  return {
    serialize: (ids) => {
      if (ids.length === 0) return null;
      const indices = ids
        .map(id => items.findIndex(item => item.id === id))
        .filter(idx => idx !== -1);
      return indices.length > 0 ? indices.join(",") : null;
    },
    deserialize: (raw, defaultValue) => {
      if (!raw) return defaultValue;
      const indices = raw.split(",").map(s => parseInt(s, 10)).filter(n => !isNaN(n));
      const ids = indices
        .map(idx => items[idx]?.id)
        .filter((id): id is string => id !== undefined);
      return ids.length > 0 ? ids : defaultValue;
    },
  };
}

/**
 * Create a serializer that stores array indices for a Set of IDs.
 * Uses the item's index in the provided array as the compact representation.
 * 
 * @param items - Array of items with an id property (order must be stable!)
 * @returns Serializer that converts between Set<string> IDs and compact index string
 * 
 * @example
 * // URL: ?enemies=0,3,7 instead of ?enemies=0xF130001D29279306,0xF130013C3B271480,...
 * const serializer = createIndexedSetSerializer(mergedEnemies);
 */
function createIndexedSetSerializer<T extends { id: string }>(
  items: readonly T[]
): Serializer<Set<string>> {
  return {
    serialize: (ids) => {
      if (ids.size === 0) return null;
      const indices = Array.from(ids)
        .map(id => items.findIndex(item => item.id === id))
        .filter(idx => idx !== -1);
      return indices.length > 0 ? indices.join(",") : null;
    },
    deserialize: (raw, defaultValue) => {
      if (!raw) return defaultValue;
      const indices = raw.split(",").map(s => parseInt(s, 10)).filter(n => !isNaN(n));
      const ids = indices
        .map(idx => items[idx]?.id)
        .filter((id): id is string => id !== undefined);
      return ids.length > 0 ? new Set(ids) : defaultValue;
    },
  };
}

/**
 * Create a serializer for a Set of IDs from a Record/object.
 * Sorts keys deterministically to ensure stable indices.
 * 
 * @param record - Object mapping IDs to values
 * @returns Serializer that converts between Set<string> IDs and compact index string
 * 
 * @example
 * // URL: ?players=0,1,2 instead of ?players=0x0000000000024225,0x0000000000024226,...
 * const serializer = createIndexedRecordSetSerializer(instance.players);
 */
function createIndexedRecordSetSerializer<T>(
  record: Record<string, T>
): Serializer<Set<string>> {
  // Sort keys for deterministic ordering
  const sortedKeys = Object.keys(record).sort();
  return {
    serialize: (ids) => {
      if (ids.size === 0) return null;
      const indices = Array.from(ids)
        .map(id => sortedKeys.indexOf(id))
        .filter(idx => idx !== -1);
      return indices.length > 0 ? indices.join(",") : null;
    },
    deserialize: (raw, defaultValue) => {
      if (!raw) return defaultValue;
      const indices = raw.split(",").map(s => parseInt(s, 10)).filter(n => !isNaN(n));
      const ids = indices
        .map(idx => sortedKeys[idx])
        .filter((id): id is string => id !== undefined);
      return ids.length > 0 ? new Set(ids) : defaultValue;
    },
  };
}

export const serializers = {
  string: stringSerializer,
  stringArray: stringArraySerializer,
  stringSet: stringSetSerializer,
  // Factory functions for index-based serializers
  indexedArray: createIndexedArraySerializer,
  indexedSet: createIndexedSetSerializer,
  indexedRecordSet: createIndexedRecordSetSerializer,
} as const;

/**
 * Hook to read/write a single URL search param with type-safe serialization.
 *
 * @param key - The URL param key
 * @param defaultValue - Default value when param is not present
 * @param serializer - How to serialize/deserialize the value
 * @returns [value, setValue] tuple similar to useState
 *
 * @example
 * ```tsx
 * const [panelType, setPanelType] = useUrlState("panel", "damage_done", serializers.string);
 * const [selectedIds, setSelectedIds] = useUrlState("encounters", [], serializers.stringArray);
 * ```
 */
export function useUrlState<T>(
  key: string,
  defaultValue: T,
  serializer: Serializer<T>
): [T, (value: T | ((prev: T) => T)) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const rawValue = searchParams.get(key);
  const value = serializer.deserialize(rawValue, defaultValue);

  const setValue = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      setSearchParams(
        (prev) => {
          const currentRaw = prev.get(key);
          const currentValue = serializer.deserialize(currentRaw, defaultValue);
          const resolvedValue =
            typeof newValue === "function"
              ? (newValue as (prev: T) => T)(currentValue)
              : newValue;

          const serialized = serializer.serialize(resolvedValue);
          const newParams = new URLSearchParams(prev);

          if (serialized === null) {
            newParams.delete(key);
          } else {
            newParams.set(key, serialized);
          }

          return newParams;
        },
        { replace: true }
      );
    },
    [key, defaultValue, serializer, setSearchParams]
  );

  return [value, setValue];
}

/**
 * Hook for URL state with an indexed serializer.
 * The serializer is created from the items list and recreated when items change.
 * 
 * For arrays: stores indices into the items array instead of full IDs.
 * For sets: stores indices into the items array instead of full IDs.
 * 
 * @example
 * ```tsx
 * // Store encounter selection as indices: ?encounters=0,2,5
 * const [selectedIds, setSelectedIds] = useIndexedUrlState(
 *   "encounters", 
 *   [], 
 *   instance.encounters,
 *   "array"
 * );
 * 
 * // Store enemy selection as indices: ?enemies=0,3,7
 * const [selectedEnemies, setSelectedEnemies] = useIndexedUrlState(
 *   "enemies",
 *   new Set<string>(),
 *   mergedEnemies,
 *   "set"
 * );
 * ```
 */
export function useIndexedUrlState<T extends { id: string }>(
  key: string,
  defaultValue: string[],
  items: readonly T[],
  type: "array"
): [string[], (value: string[] | ((prev: string[]) => string[])) => void];
export function useIndexedUrlState<T extends { id: string }>(
  key: string,
  defaultValue: Set<string>,
  items: readonly T[],
  type: "set"
): [Set<string>, (value: Set<string> | ((prev: Set<string>) => Set<string>)) => void];
export function useIndexedUrlState<T extends { id: string }>(
  key: string,
  defaultValue: string[] | Set<string>,
  items: readonly T[],
  type: "array" | "set"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): [any, (value: any) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  // Build ID->index and index->ID maps for O(1) lookups
  const { idToIndex, indexToId } = useMemo(() => {
    const idToIdx = new Map<string, number>();
    const idxToId = new Map<number, string>();
    items.forEach((item, idx) => {
      idToIdx.set(item.id, idx);
      idxToId.set(idx, item.id);
    });
    return { idToIndex: idToIdx, indexToId: idxToId };
  }, [items]);

  // Deserialize from URL
  const value = useMemo(() => {
    const raw = searchParams.get(key);
    if (!raw) return defaultValue;
    
    const indices = raw.split(",").map(s => parseInt(s, 10)).filter(n => !isNaN(n));
    const ids = indices
      .map(idx => indexToId.get(idx))
      .filter((id): id is string => id !== undefined);
    
    if (ids.length === 0) return defaultValue;
    return type === "set" ? new Set(ids) : ids;
  }, [searchParams, key, defaultValue, indexToId, type]);

  const setValue = useCallback(
    (newValue: unknown) => {
      setSearchParams(
        (prev) => {
          // Get current value for functional updates
          const currentRaw = prev.get(key);
          let currentIds: string[];
          if (!currentRaw) {
            currentIds = type === "set" 
              ? Array.from(defaultValue as Set<string>) 
              : (defaultValue as string[]);
          } else {
            const indices = currentRaw.split(",").map(s => parseInt(s, 10)).filter(n => !isNaN(n));
            currentIds = indices
              .map(idx => indexToId.get(idx))
              .filter((id): id is string => id !== undefined);
          }
          const currentValue = type === "set" ? new Set(currentIds) : currentIds;

          // Resolve functional update
          const resolvedValue = typeof newValue === "function"
            ? (newValue as (prev: typeof currentValue) => typeof currentValue)(currentValue)
            : newValue;

          // Convert to indices
          const idsArray = type === "set" 
            ? Array.from(resolvedValue as Set<string>)
            : (resolvedValue as string[]);
          
          const indices = idsArray
            .map(id => idToIndex.get(id))
            .filter((idx): idx is number => idx !== undefined);

          const newParams = new URLSearchParams(prev);
          if (indices.length === 0) {
            newParams.delete(key);
          } else {
            newParams.set(key, indices.join(","));
          }
          return newParams;
        },
        { replace: true }
      );
    },
    [key, defaultValue, idToIndex, indexToId, setSearchParams, type]
  );

  return [value, setValue];
}

/**
 * Hook for URL state with an indexed serializer for Record keys.
 * Keys are sorted alphabetically for deterministic ordering.
 * 
 * @example
 * ```tsx
 * // Store player selection as indices: ?players=0,1,2
 * const [selectedPlayers, setSelectedPlayers] = useIndexedRecordUrlState(
 *   "players",
 *   new Set<string>(),
 *   instance.players
 * );
 * ```
 */
export function useIndexedRecordUrlState<T>(
  key: string,
  defaultValue: Set<string>,
  record: Record<string, T>
): [Set<string>, (value: Set<string> | ((prev: Set<string>) => Set<string>)) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  // Build lookup maps (keys are sorted for deterministic ordering)
  const { idToIndex, indexToId } = useMemo(() => {
    const keys = Object.keys(record).sort();
    const idToIdx = new Map<string, number>();
    const idxToId = new Map<number, string>();
    keys.forEach((id, idx) => {
      idToIdx.set(id, idx);
      idxToId.set(idx, id);
    });
    return { idToIndex: idToIdx, indexToId: idxToId };
  }, [record]);

  // Deserialize from URL
  const value = useMemo(() => {
    const raw = searchParams.get(key);
    if (!raw) return defaultValue;
    
    const indices = raw.split(",").map(s => parseInt(s, 10)).filter(n => !isNaN(n));
    const ids = indices
      .map(idx => indexToId.get(idx))
      .filter((id): id is string => id !== undefined);
    
    return ids.length > 0 ? new Set(ids) : defaultValue;
  }, [searchParams, key, defaultValue, indexToId]);

  const setValue = useCallback(
    (newValue: Set<string> | ((prev: Set<string>) => Set<string>)) => {
      setSearchParams(
        (prev) => {
          // Get current value for functional updates
          const currentRaw = prev.get(key);
          let currentSet: Set<string>;
          if (!currentRaw) {
            currentSet = defaultValue;
          } else {
            const indices = currentRaw.split(",").map(s => parseInt(s, 10)).filter(n => !isNaN(n));
            const ids = indices
              .map(idx => indexToId.get(idx))
              .filter((id): id is string => id !== undefined);
            currentSet = new Set(ids);
          }

          // Resolve functional update
          const resolvedValue = typeof newValue === "function"
            ? newValue(currentSet)
            : newValue;

          // Convert to indices
          const indices = Array.from(resolvedValue)
            .map(id => idToIndex.get(id))
            .filter((idx): idx is number => idx !== undefined);

          const newParams = new URLSearchParams(prev);
          if (indices.length === 0) {
            newParams.delete(key);
          } else {
            newParams.set(key, indices.join(","));
          }
          return newParams;
        },
        { replace: true }
      );
    },
    [key, defaultValue, idToIndex, indexToId, setSearchParams]
  );

  return [value, setValue];
}

/**
 * Reserved keywords for encounter selection shortcuts.
 * When all bosses or all trash are selected, store keyword instead of indices.
 */
export type EncounterKeyword = "all" | "bosses" | "trash";

/**
 * Hook for encounter selection with keyword shortcuts.
 * Stores "all", "bosses", or "trash" when those exact sets are selected,
 * otherwise falls back to index-based storage.
 * 
 * @param key - URL param key
 * @param encounters - Full list of encounters (must have id and boss properties)
 * @param defaultValue - Default selection (IDs)
 * 
 * @example
 * ```tsx
 * // URL: ?encounters=bosses instead of ?encounters=0,2,5,7
 * const [selectedIds, setSelectedIds] = useEncounterUrlState(
 *   "encounters",
 *   instance.encounters,
 *   [defaultEncounterId]
 * );
 * ```
 */
export function useEncounterUrlState<T extends { id: string; boss: boolean }>(
  key: string,
  encounters: readonly T[],
  defaultValue: string[]
): [string[], (value: string[] | ((prev: string[]) => string[])) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  // Precompute ID sets for each keyword
  const { allIds, bossIds, trashIds, idToIndex, indexToId } = useMemo(() => {
    const all = new Set(encounters.map(e => e.id));
    const bosses = new Set(encounters.filter(e => e.boss).map(e => e.id));
    const trash = new Set(encounters.filter(e => !e.boss).map(e => e.id));
    
    const idToIdx = new Map<string, number>();
    const idxToId = new Map<number, string>();
    encounters.forEach((e, idx) => {
      idToIdx.set(e.id, idx);
      idxToId.set(idx, e.id);
    });
    
    return { allIds: all, bossIds: bosses, trashIds: trash, idToIndex: idToIdx, indexToId: idxToId };
  }, [encounters]);

  // Helper to check if two sets are equal
  const setsEqual = (a: Set<string>, b: Set<string>) => 
    a.size === b.size && [...a].every(id => b.has(id));

  // Deserialize from URL
  const value = useMemo(() => {
    const raw = searchParams.get(key);
    if (!raw) return defaultValue;
    
    // Check for keywords
    if (raw === "all") return Array.from(allIds);
    if (raw === "bosses") return Array.from(bossIds);
    if (raw === "trash") return Array.from(trashIds);
    
    // Parse as indices
    const indices = raw.split(",").map(s => parseInt(s, 10)).filter(n => !isNaN(n));
    const ids = indices
      .map(idx => indexToId.get(idx))
      .filter((id): id is string => id !== undefined);
    
    return ids.length > 0 ? ids : defaultValue;
  }, [searchParams, key, defaultValue, allIds, bossIds, trashIds, indexToId]);

  const setValue = useCallback(
    (newValue: string[] | ((prev: string[]) => string[])) => {
      setSearchParams(
        (prev) => {
          // Get current value for functional updates
          const currentRaw = prev.get(key);
          let currentIds: string[];
          if (!currentRaw) {
            currentIds = defaultValue;
          } else if (currentRaw === "all") {
            currentIds = Array.from(allIds);
          } else if (currentRaw === "bosses") {
            currentIds = Array.from(bossIds);
          } else if (currentRaw === "trash") {
            currentIds = Array.from(trashIds);
          } else {
            const indices = currentRaw.split(",").map(s => parseInt(s, 10)).filter(n => !isNaN(n));
            currentIds = indices
              .map(idx => indexToId.get(idx))
              .filter((id): id is string => id !== undefined);
          }

          // Resolve functional update
          const resolvedIds = typeof newValue === "function"
            ? newValue(currentIds)
            : newValue;

          const selectedSet = new Set(resolvedIds);
          
          // Check for keyword matches
          let serialized: string | null = null;
          if (setsEqual(selectedSet, allIds)) {
            serialized = "all";
          } else if (setsEqual(selectedSet, bossIds) && bossIds.size > 0) {
            serialized = "bosses";
          } else if (setsEqual(selectedSet, trashIds) && trashIds.size > 0) {
            serialized = "trash";
          } else if (resolvedIds.length > 0) {
            // Fall back to indices
            const indices = resolvedIds
              .map(id => idToIndex.get(id))
              .filter((idx): idx is number => idx !== undefined);
            serialized = indices.length > 0 ? indices.join(",") : null;
          }

          const newParams = new URLSearchParams(prev);
          if (serialized === null) {
            newParams.delete(key);
          } else {
            newParams.set(key, serialized);
          }
          return newParams;
        },
        { replace: true }
      );
    },
    [key, defaultValue, allIds, bossIds, trashIds, idToIndex, indexToId, setSearchParams, setsEqual]
  );

  return [value, setValue];
}

/**
 * Hook to manage multiple related URL params at once.
 * Useful for complex state that spans multiple params.
 */
export function useUrlStateMulti<T extends Record<string, unknown>>(
  config: {
    [K in keyof T]: {
      key: string;
      defaultValue: T[K];
      serializer: Serializer<T[K]>;
    };
  }
): [T, <K extends keyof T>(key: K, value: T[K] | ((prev: T[K]) => T[K])) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read all values
  const values = {} as T;
  for (const [stateKey, { key, defaultValue, serializer }] of Object.entries(config)) {
    const rawValue = searchParams.get(key);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (values as any)[stateKey] = serializer.deserialize(rawValue, defaultValue);
  }

  const setValue = useCallback(
    <K extends keyof T>(stateKey: K, newValue: T[K] | ((prev: T[K]) => T[K])) => {
      const { key, defaultValue, serializer } = config[stateKey];

      setSearchParams(
        (prev) => {
          const currentRaw = prev.get(key);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const currentValue = (serializer as Serializer<any>).deserialize(currentRaw, defaultValue);
          const resolvedValue =
            typeof newValue === "function"
              ? (newValue as (prev: T[K]) => T[K])(currentValue)
              : newValue;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const serialized = (serializer as Serializer<any>).serialize(resolvedValue);
          const newParams = new URLSearchParams(prev);

          if (serialized === null) {
            newParams.delete(key);
          } else {
            newParams.set(key, serialized);
          }

          return newParams;
        },
        { replace: true }
      );
    },
    [config, setSearchParams]
  );

  return [values, setValue];
}
