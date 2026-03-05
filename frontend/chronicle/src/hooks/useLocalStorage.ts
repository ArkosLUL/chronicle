import { useState, useCallback, useEffect, useRef } from "react";

const LOCAL_STORAGE_EVENT = "local-storage-change";

interface LocalStorageEventDetail {
  key: string;
}

function readStoredValue<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored !== null ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function useLocalStorage<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const defaultValueRef = useRef(defaultValue);

  useEffect(() => {
    defaultValueRef.current = defaultValue;
  }, [defaultValue]);

  const [value, setValue] = useState<T>(() => readStoredValue(key, defaultValue));

  // Re-read from localStorage when key changes and when other hook instances update this key.
  useEffect(() => {
    const syncFromStorage = () => {
      setValue(readStoredValue(key, defaultValueRef.current));
    };

    syncFromStorage();

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== key) {
        return;
      }
      syncFromStorage();
    };

    const handleCustomStorageEvent = (event: Event) => {
      const customEvent = event as CustomEvent<LocalStorageEventDetail>;
      if (customEvent.detail?.key !== key) {
        return;
      }
      syncFromStorage();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(LOCAL_STORAGE_EVENT, handleCustomStorageEvent);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(LOCAL_STORAGE_EVENT, handleCustomStorageEvent);
    };
  }, [key]);

  const setStoredValue = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      const current = readStoredValue(key, defaultValueRef.current);
      const resolved =
        newValue instanceof Function ? newValue(current) : newValue;

      setValue(resolved);

      try {
        localStorage.setItem(key, JSON.stringify(resolved));
        window.dispatchEvent(
          new CustomEvent<LocalStorageEventDetail>(LOCAL_STORAGE_EVENT, {
            detail: { key },
          })
        );
      } catch {
        // Ignore storage errors (quota exceeded, etc.)
      }
    },
    [key]
  );

  return [value, setStoredValue];
}
