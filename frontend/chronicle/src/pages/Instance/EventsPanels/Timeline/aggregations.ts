/**
 * Aggregation functions for Timeline series.
 *
 * Each function transforms raw bin sums into display values.
 * The processor always stores raw sums; aggregation runs at render time
 * so switching strategies is instant (no reprocessing).
 *
 * To add a new aggregation: add an entry to AGGREGATIONS below.
 */

import type { AggregationType } from "./timelineTypes";

export type AggregationFn = (raw: number[], binMs: number) => number[];

export interface AggregationDef {
  label: string;
  description: string;
  fn: AggregationFn;
}

function rollingAvg(bins: number[], window: number): number[] {
  const out: number[] = new Array(bins.length);
  let sum = 0;
  for (let i = 0; i < bins.length; i++) {
    sum += bins[i];
    if (i >= window) sum -= bins[i - window];
    const count = Math.min(i + 1, window);
    out[i] = sum / count;
  }
  return out;
}

/** Registry of all aggregation strategies. */
export const AGGREGATIONS: Record<AggregationType, AggregationDef> = {
  sum: {
    label: "Sum",
    description: "Total value in each time window",
    fn: (raw) => raw,
  },
  rolling_avg: {
    label: "Rolling Avg (5s)",
    description: "Smoothed average over a 5-second sliding window",
    fn: (raw, binMs) => rollingAvg(raw, Math.max(1, Math.round(5000 / binMs))),
  },
  per_second: {
    label: "Per Second",
    description: "Value normalized to a per-second rate",
    fn: (raw, binMs) => {
      const factor = 1000 / binMs;
      return raw.map((v) => v * factor);
    },
  },
  cumulative: {
    label: "Cumulative",
    description: "Running total over the encounter",
    fn: (raw) => {
      let acc = 0;
      return raw.map((v) => (acc += v));
    },
  },
};

/** Apply the named aggregation to raw bins. Falls back to identity. */
export function applyAggregation(raw: number[], binMs: number, type: AggregationType): number[] {
  const def = AGGREGATIONS[type];
  return def ? def.fn(raw, binMs) : raw;
}
