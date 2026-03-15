/**
 * Shared types for the Timeline panel.
 */

import type { StreamType } from "@/hooks/instanceEvents";
import type { PanelFilter } from "../processors/filters";

/** Configuration for a single time series line on the chart. */
export interface TimelineSeriesConfig {
  /** Unique id, e.g. "s1", "s2" */
  id: string;
  /** User-editable display name (shown in legend) */
  name: string;
  /** Which event stream to pull data from */
  stream: StreamType;
  /** How to reduce raw bins for display */
  aggregation: AggregationType;
  /** Line color (hex) */
  color: string;
  /** Per-series filters */
  filters: PanelFilter[];
}

/**
 * Aggregation strategies applied post-processing.
 * Add new entries here + in `AGGREGATIONS` in aggregations.ts.
 */
export type AggregationType = "sum" | "rolling_avg" | "per_second" | "cumulative";

/** General timeline settings (not per-series). */
export interface TimelineSettings {
  /** Bucket width in ms */
  binMs: number;
}

export const DEFAULT_BIN_MS = 1000;

/** Preset line colors for new series */
export const SERIES_COLORS = [
  "#C79C6E", // tan
  "#F58CBA", // pink
  "#ABD473", // green
  "#69CCF0", // light blue
  "#FFF569", // yellow
  "#C41F3B", // red
  "#0070DE", // blue
  "#9482C9", // purple
  "#FF7D0A", // orange
  "#06b6d4", // cyan
];

let _nextId = 1;
export function nextSeriesId(): string {
  return `s${_nextId++}`;
}

export function createDefaultSeries(index: number = 0): TimelineSeriesConfig {
  return {
    id: nextSeriesId(),
    name: "Damage",
    stream: "damage",
    aggregation: "sum",
    color: SERIES_COLORS[index % SERIES_COLORS.length],
    filters: [],
  };
}

export function getDefaultSettings(): TimelineSettings {
  return { binMs: DEFAULT_BIN_MS };
}

/**
 * Stable fallback series used when no panelContext config exists.
 * Must match FALLBACK_SERIES in timeline.processor.ts (id: "s0").
 */
const FALLBACK_SERIES_CONFIG: TimelineSeriesConfig[] = [
  { id: "s0", name: "Damage", stream: "damage", aggregation: "sum", color: SERIES_COLORS[0], filters: [] },
];

/** Extract series configs from panelContext, falling back to one default series. */
export function getSeriesConfigs(panelContext: Record<string, unknown> | null | undefined): TimelineSeriesConfig[] {
  const raw = panelContext?.timelineSeries;
  if (Array.isArray(raw) && raw.length > 0) return raw as TimelineSeriesConfig[];
  return FALLBACK_SERIES_CONFIG;
}

/** Extract settings from panelContext. */
export function getTimelineSettings(panelContext: Record<string, unknown> | null | undefined): TimelineSettings {
  const raw = panelContext?.timelineSettings;
  if (raw && typeof raw === "object" && "binMs" in raw) return raw as TimelineSettings;
  return getDefaultSettings();
}

// ── Persistence via panelOption ─────────────────────────────────────────────

interface PersistedTimelineConfig {
  series: TimelineSeriesConfig[];
  settings: TimelineSettings;
}

/**
 * Serialize timeline config to a panelOption token.
 * Uses base64-encoded JSON with a `tl:` prefix so it coexists
 * with other comma-separated tokens (bc:, t:, g:, p:).
 */
export function serializeTimelineConfig(series: TimelineSeriesConfig[], settings: TimelineSettings): string {
  const payload: PersistedTimelineConfig = { series, settings };
  return btoa(JSON.stringify(payload));
}

/**
 * Deserialize timeline config from a panelOption token value.
 * Expects the base64 payload (without the `tl:` prefix).
 */
export function deserializeTimelineConfig(encoded: string | null | undefined): PersistedTimelineConfig | null {
  if (!encoded) return null;
  try {
    const json = atob(encoded);
    const parsed = JSON.parse(json) as PersistedTimelineConfig;
    if (parsed && Array.isArray(parsed.series) && parsed.series.length > 0) {
      return parsed;
    }
  } catch {
    // Invalid base64/JSON — ignore
  }
  return null;
}

/** Extract the `tl:` token value from a panelOption string. */
export function extractTimelineToken(panelOption: string | null | undefined): string | null {
  if (!panelOption) return null;
  const tokens = panelOption.split(",");
  for (const token of tokens) {
    if (token.startsWith("tl:")) return token.slice(3);
  }
  return null;
}

/**
 * Build panelContext from persisted panelOption.
 * Used to hydrate panelContext on mount when panelContext is empty but panelOption has saved config.
 */
export function hydrateFromPanelOption(panelOption: string | null | undefined): Record<string, unknown> | null {
  const encoded = extractTimelineToken(panelOption);
  const config = deserializeTimelineConfig(encoded);
  if (!config) return null;
  return {
    timelineSeries: config.series,
    timelineSettings: config.settings,
  };
}
