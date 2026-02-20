import { useState, useCallback, useEffect } from "react";

export function useLocalStorage<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  // Re-read from localStorage when key changes
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      setValue(stored !== null ? JSON.parse(stored) : defaultValue);
    } catch {
      setValue(defaultValue);
    }
  }, [key, defaultValue]);

  const setStoredValue = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved =
          newValue instanceof Function ? newValue(prev) : newValue;
        try {
          localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          // Ignore storage errors (quota exceeded, etc.)
        }
        return resolved;
      });
    },
    [key]
  );

  return [value, setStoredValue];
}
