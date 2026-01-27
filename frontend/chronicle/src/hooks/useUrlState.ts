/**
 * Hook to sync state with URL search params.
 * Allows state to persist across page refreshes and be shareable via URL.
 */

import { useCallback } from "react";
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

export const serializers = {
  string: stringSerializer,
  stringArray: stringArraySerializer,
  stringSet: stringSetSerializer,
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
