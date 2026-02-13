/**
 * RandomTip - Shows a random tip from a pool, stable for the page session.
 * 
 * Used inside tooltips to keep tip content engaging while being predictable.
 * The tip is selected randomly once per unique `id` and cached for the session.
 */

// Module-level cache - persists for the page session
const tipCache = new Map<string, string>();

export interface RandomTipProps {
  /** Unique identifier for this tip location (e.g., "encounters", "entity-panel") */
  id: string;
  /** Array of tip strings to randomly select from */
  tips: string[];
}

/**
 * Renders a random tip from the provided pool.
 * The tip is selected once per unique `id` and stays stable for the entire page session.
 */
export function RandomTip({ id, tips }: RandomTipProps) {
  // Check cache first
  let tip = tipCache.get(id);
  
  if (!tip && tips.length > 0) {
    // Select and cache a random tip
    tip = tips[Math.floor(Math.random() * tips.length)];
    tipCache.set(id, tip);
  }
  
  return <span>{tip ?? ""}</span>;
}
