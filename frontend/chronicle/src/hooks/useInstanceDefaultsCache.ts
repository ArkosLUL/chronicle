import { useEffect, useMemo } from "react";
import { useInstanceDefaults, type InstanceDefaultsResponse } from "@/api/queries";

const CACHE_KEY = "instance-defaults-cache";

function readInstanceDefaultsCache(): InstanceDefaultsResponse | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as InstanceDefaultsResponse) : null;
  } catch {
    return null;
  }
}

function writeInstanceDefaultsCache(data: InstanceDefaultsResponse) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // Ignore localStorage errors.
  }
}

export function clearInstanceDefaultsCache() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(CACHE_KEY);
}

export function useInstanceDefaultsCache(enabled: boolean): InstanceDefaultsResponse | null {
  const { data } = useInstanceDefaults({ enabled, staleTime: 0 });

  useEffect(() => {
    if (data) {
      writeInstanceDefaultsCache(data);
    }
  }, [data]);

  return useMemo(() => data ?? readInstanceDefaultsCache(), [data]);
}
