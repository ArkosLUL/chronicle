import { useRef } from "react";

/**
 * Hook to cache a value once it becomes valid.
 * Cache is invalidated when dependencies change.
 * 
 * @param value - The current value to potentially cache
 * @param isValid - Function to determine if the value should be cached
 * @param deps - Optional dependencies that invalidate the cache when changed
 * @returns Object with cachedValue (stable reference) and hasCache flag
 * 
 * @example
 * ```tsx
 * // Cache result once it has data, invalidate when sourceType changes
 * const { cachedValue, hasCache } = useCachedValue(
 *   result,
 *   (r) => r.data.size > 0,
 *   [sourceType]
 * );
 * 
 * // Use cachedValue - won't change after first valid value (until deps change)
 * const computed = useMemo(() => process(cachedValue), [cachedValue]);
 * ```
 */
export function useCachedValue<T>(
  value: T,
  isValid: (value: T) => boolean,
  deps: unknown[] = []
): { cachedValue: T; hasCache: boolean } {
  const cacheRef = useRef<{ value: T; deps: unknown[] } | null>(null);
  // Track the stale value when deps change - we shouldn't cache this
  const staleValueRef = useRef<T | null>(null);
  
  // Check if deps match the cached deps
  const depsMatch = cacheRef.current !== null &&
    deps.length === cacheRef.current.deps.length &&
    deps.every((dep, i) => dep === cacheRef.current!.deps[i]);
  
  // Invalidate cache if deps changed
  if (!depsMatch && cacheRef.current !== null) {
    // Mark the current value as stale - it's from the old deps
    staleValueRef.current = value;
    cacheRef.current = null;
  }
  
  // Try to cache if we don't have one and value is valid
  // But NOT if value is the same stale value from before deps changed
  if (cacheRef.current === null && isValid(value) && value !== staleValueRef.current) {
    cacheRef.current = { value, deps };
    staleValueRef.current = null;
  }
  
  // Return cached value if available, otherwise current value
  if (cacheRef.current !== null) {
    return { cachedValue: cacheRef.current.value, hasCache: true };
  }
  
  return { cachedValue: value, hasCache: false };
}
