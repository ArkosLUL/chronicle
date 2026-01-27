import { useState } from "react";

/**
 * Hook to cache a value once it becomes valid.
 * Once cached, the value never changes regardless of new inputs.
 * 
 * @param value - The current value to potentially cache
 * @param isValid - Function to determine if the value should be cached
 * @returns Object with cachedValue (stable reference) and hasCache flag
 * 
 * @example
 * ```tsx
 * // Cache result once it has data
 * const { cachedValue, hasCache } = useCachedValue(
 *   result,
 *   (r) => r.data.size > 0
 * );
 * 
 * // Use cachedValue - won't change after first valid value
 * const computed = useMemo(() => process(cachedValue), [cachedValue]);
 * ```
 */
export function useCachedValue<T>(
  value: T,
  isValid: (value: T) => boolean
): { cachedValue: T; hasCache: boolean } {
  const [cached, setCached] = useState<T | null>(null);
  
  // Set state during render (not in effect) - this is the React-approved
  // pattern for "adjusting state based on props". The condition prevents
  // infinite loops since we only set once.
  if (cached === null && isValid(value)) {
    setCached(value);
    return { cachedValue: value, hasCache: true };
  }
  
  return { 
    cachedValue: cached ?? value, 
    hasCache: cached !== null 
  };
}
