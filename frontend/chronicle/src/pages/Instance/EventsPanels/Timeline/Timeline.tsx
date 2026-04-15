/**
 * Timeline panel — Nivo line chart of damage over time.
 *
 * Click-and-drag on the chart to set the TimeRange (used by all panels).
 * Double-click to reset.
 */
/* eslint-disable react-refresh/only-export-components */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TrendingUp } from "lucide-react";
import { ResponsiveLine, type LineSeries, type LineCustomSvgLayerProps, type SliceTooltipProps } from "@nivo/line";
import { useIsMobile } from "@/hooks/useIsMobile";

/** Custom series type with color for per-line coloring. */
interface ColoredSeries extends LineSeries {
  color: string;
}
import type { PanelDefinition, PanelRenderProps } from "../types";
import { timelineProcessor, type TimelineResult, type TimelineSeriesMeta } from "./timeline.processor";
import { applyAggregation } from "./aggregations";
import { TimelineFilterEditor } from "./TimelineFilterEditor";
import { getSeriesConfigs, getTimelineSettings, hydrateFromPanelOption, serializeTimelineConfig } from "./timelineTypes";

import { useTimeRangeContextOptional } from "../../TimeRangeContext";

/**
 * Create the Timeline panel definition.
 */
export function createTimelinePanel(): PanelDefinition<TimelineResult> {
  return {
    ...timelineProcessor,
    label: "Line Chart",
    icon: <TrendingUp className="h-4 w-4" />,
    supportsPerSecond: false,
    supportsFiltering: false, // filters are per-series on card back

    hydrateContext: (panelOption: string) => hydrateFromPanelOption(panelOption),
    renderCardBack: (props) => <TimelineFilterEditor {...props} />,

    render: (props: PanelRenderProps<TimelineResult>) => {
      return <TimelineContent {...props} />;
    },
  };
}

// ── Slice tooltip ────────────────────────────────────────────────────────────

function formatValue(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return v.toFixed(0);
}

function TimelineSliceTooltip({ slice, seriesMeta }: SliceTooltipProps<ColoredSeries> & { seriesMeta: Map<string, TimelineSeriesMeta> }) {
  const xVal = slice.points[0]?.data.x;
  // Sort points by value descending
  const sorted = [...slice.points].sort(
    (a, b) => (Number(b.data.yFormatted) || 0) - (Number(a.data.yFormatted) || 0),
  );

  return (
    <div className="bg-zinc-900/95 border border-zinc-700 rounded-md px-2.5 py-1.5 shadow-lg text-xs min-w-[120px]">
      <div className="text-zinc-400 mb-1 font-medium">{String(xVal)}s</div>
      {sorted.map((point) => {
        const displayName = seriesMeta.get(String(point.seriesId))?.name ?? point.seriesId;
        return (
          <div key={point.id} className="flex items-center gap-1.5 py-px">
            <span
              className="inline-block h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: point.seriesColor }}
            />
            <span className="text-zinc-300 truncate max-w-[100px]">{String(displayName)}</span>
            <span className="ml-auto text-zinc-100 font-medium tabular-nums">
              {formatValue(point.data.y as number)}{seriesMeta.get(String(point.seriesId))?.aggregation === "per_second" ? "/s" : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Drag selection (uses Nivo's xScale for pixel-perfect alignment) ──────────

interface DragState {
  /** Start of selection in seconds (snapped to 1s) */
  startSec: number;
  /** Current drag position in seconds (snapped to 1s) */
  currentSec: number;
  active: boolean;
}

/** D3 linear scale with invert (Nivo wraps d3-scale under the hood). */
type D3ScaleLinear = ((v: number) => number) & { invert: (px: number) => number };

const CHART_MARGIN_DESKTOP = { top: 10, right: 20, bottom: 36, left: 50 } as const;
const CHART_MARGIN_MOBILE = { top: 10, right: 8, bottom: 30, left: 36 } as const;

function TimelineContent({ result, durationMs, panelContext: pc, panelOption, setPanelContext, setPanelOption, context }: PanelRenderProps<TimelineResult>) {
  const isMobile = useIsMobile();
  const CHART_MARGIN = isMobile ? CHART_MARGIN_MOBILE : CHART_MARGIN_DESKTOP;

  const timeRange = useTimeRangeContextOptional();
  const containerRef = useRef<HTMLDivElement>(null);
  // Capture Nivo's xScale so mouse handlers can convert pixels ↔ data values.
  const xScaleRef = useRef<D3ScaleLinear | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  /** Series IDs currently hidden by clicking the legend (hydrated from settings). */
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(() => {
    const settings = getTimelineSettings(pc);
    return new Set(settings.hiddenSeries ?? []);
  });

  // Hydrate panelContext + hiddenSeries from saved panelOption on first render
  const hydrated = useRef(false);
  useEffect(() => {
    if (!hydrated.current && !pc?.timelineSeries && panelOption && setPanelContext) {
      const restored = hydrateFromPanelOption(panelOption);
      if (restored) {
        setPanelContext(restored);
        // Also hydrate hiddenSeries from the restored settings
        const restoredSettings = getTimelineSettings(restored);
        if (restoredSettings.hiddenSeries?.length) {
          setHiddenSeries(new Set(restoredSettings.hiddenSeries));
        }
      }
    }
    hydrated.current = true;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- intentionally runs once

  // Sync hiddenSeries when panelContext is hydrated externally (e.g. by parent hydrateContext
  // or preset switch). Track the serialised series config so we re-apply when it changes.
  const lastSyncedSeriesRef = useRef<string | null>(null);
  useEffect(() => {
    if (!pc?.timelineSettings) return;
    const settings = getTimelineSettings(pc);
    const key = JSON.stringify(settings.hiddenSeries ?? []);
    if (key === lastSyncedSeriesRef.current) return;
    lastSyncedSeriesRef.current = key;
    setHiddenSeries(new Set(settings.hiddenSeries ?? []));
  }, [pc]);

  // Current series IDs from config — used to filter stale results during reprocessing
  const activeSeriesIds = useMemo(() => {
    const configs = getSeriesConfigs(pc);
    return new Set(configs.map((c) => c.id));
  }, [pc]);

  // Total duration in seconds — use encounter duration, not last-event time
  const totalSec = durationMs > 0 ? durationMs / 1000 : (result.binCount * result.binMs) / 1000;
  const totalBins = durationMs > 0
    ? Math.ceil(durationMs / result.binMs)
    : result.binCount;

  // Convert processor result → nivo series, applying per-series aggregation.
  // Filters out stale series that no longer exist in config (e.g., after deletion).
  const data = useMemo(() => {
    const series: ColoredSeries[] = [];

    for (const [seriesId, rawBins] of result.series.entries()) {
      if (!activeSeriesIds.has(seriesId)) continue;

      const meta = result.seriesMeta.get(seriesId);
      if (!meta) continue;

      // Apply aggregation (runs on raw sums, instant — no reprocessing)
      const displayBins = applyAggregation(rawBins, result.binMs, meta.aggregation);

      const points = [{ x: 0, y: 0 }]; // No data at t=0
      for (let b = 0; b < totalBins; b++) {
        const val = b < displayBins.length ? displayBins[b] : 0;
        points.push({ x: ((b + 1) * result.binMs) / 1000, y: val });
      }
      series.push({ id: seriesId, data: points, color: meta.color });
    }

    return series;
  }, [result, totalBins, activeSeriesIds]);
  // Build legend from all series (before filtering hidden ones)
  const legendData = useMemo(() => {
    return data.map((s) => ({
      id: s.id,
      label: result.seriesMeta.get(String(s.id))?.name ?? String(s.id),
      color: s.color ?? "#888",
      hidden: hiddenSeries.has(String(s.id)),
    }));
  }, [data, result.seriesMeta, hiddenSeries]);

  // Filter hidden series from chart data
  const visibleData = useMemo(() => {
    if (hiddenSeries.size === 0) return data;
    return data.filter((s) => !hiddenSeries.has(String(s.id)));
  }, [data, hiddenSeries]);

  const toggleSeries = useCallback((seriesId: string) => {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(seriesId)) next.delete(seriesId);
      else next.add(seriesId);

      // Persist to panelContext + panelOption
      const configs = getSeriesConfigs(pc);
      const settings = getTimelineSettings(pc);
      const newSettings = { ...settings, hiddenSeries: next.size > 0 ? [...next] : undefined };
      if (setPanelContext) {
        setPanelContext({ ...(pc ?? {}), timelineSettings: newSettings });
      }
      if (setPanelOption) {
        const existingTokens = (panelOption ?? "").split(",").filter((t) => t && !t.startsWith("tl:"));
        const tlToken = `tl:${serializeTimelineConfig(configs, newSettings)}`;
        existingTokens.push(tlToken);
        setPanelOption(existingTokens.join(","));
      }

      return next;
    });
  }, [pc, panelOption, setPanelContext, setPanelOption]);


  // Convert a mouse clientX to snapped seconds using Nivo's own xScale.
  const clientXToSec = useCallback((clientX: number, containerRect: DOMRect) => {
    const scale = xScaleRef.current;
    if (!scale?.invert) return 0;
    const px = clientX - containerRect.left - CHART_MARGIN.left;
    const rawSec = scale.invert(px);
    return Math.max(0, Math.round(rawSec)); // snap to nearest 1s
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const sec = clientXToSec(e.clientX, rect);
    setDrag({ startSec: sec, currentSec: sec, active: true });
  }, [clientXToSec]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!drag?.active) return;
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const sec = clientXToSec(e.clientX, rect);
      setDrag((prev) => (prev ? { ...prev, currentSec: sec } : null));
    },
    [drag?.active, clientXToSec],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!drag?.active || !timeRange) {
        setDrag(null);
        return;
      }
      const container = containerRef.current;
      if (!container) { setDrag(null); return; }
      const rect = container.getBoundingClientRect();
      const endSec = clientXToSec(e.clientX, rect);

      const lo = Math.min(drag.startSec, endSec);
      const hi = Math.max(drag.startSec, endSec);

      if (hi > lo) {
        timeRange.setRange(lo * 1000, hi * 1000);
      }
      setDrag(null);
    },
    [drag, timeRange, clientXToSec],
  );

  const handleDoubleClick = useCallback(() => {
    timeRange?.reset();
  }, [timeRange]);

  // Combined Nivo SVG layer: captures xScale + renders highlight & drag rect.
  const trEnabled = timeRange?.enabled ?? false;
  const trStart = timeRange?.startOffsetMs ?? null;
  const trEnd = timeRange?.endOffsetMs ?? null;
  const dragStartSec = drag?.startSec ?? 0;
  const dragCurrentSec = drag?.currentSec ?? 0;
  const dragActive = drag?.active ?? false;

  const overlayLayer = useCallback(
    ({ innerHeight, xScale }: LineCustomSvgLayerProps<ColoredSeries>) => {
      // Capture the scale so mouse handlers can use xScale.invert()
      xScaleRef.current = xScale as unknown as D3ScaleLinear;

      const scale = xScale as unknown as D3ScaleLinear;
      const elements: React.ReactNode[] = [];

      // Saved time-range highlight
      if (trEnabled && trStart != null && trEnd != null) {
        const x1 = scale(trStart / 1000);
        const x2 = scale(trEnd / 1000);
        elements.push(
          <rect
            key="highlight"
            x={Math.min(x1, x2)}
            y={0}
            width={Math.abs(x2 - x1)}
            height={innerHeight}
            fill="rgba(59, 130, 246, 0.15)"
            stroke="rgba(59, 130, 246, 0.5)"
            strokeWidth={1}
          />,
        );
      }

      // Ephemeral drag selection rectangle
      if (dragActive && dragStartSec !== dragCurrentSec) {
        const x1 = scale(Math.min(dragStartSec, dragCurrentSec));
        const x2 = scale(Math.max(dragStartSec, dragCurrentSec));
        elements.push(
          <rect
            key="drag"
            x={x1}
            y={0}
            width={x2 - x1}
            height={innerHeight}
            fill="rgba(59, 130, 246, 0.2)"
            stroke="rgba(59, 130, 246, 0.5)"
            strokeWidth={1}
          />,
        );
      }

      return elements.length > 0 ? <>{elements}</> : null;
    },
    [trEnabled, trStart, trEnd, dragActive, dragStartSec, dragCurrentSec],
  );

  if (isMobile && context.selectedEncounterIds.length > 1) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm text-center px-4">
        Please select only 1 encounter, or use desktop to see this line chart.
      </div>
    );
  }

  if (visibleData.length === 0 && data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No data for selected encounters
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-full"
      style={{ cursor: "crosshair" }}
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
    >
      <ResponsiveLine
        data={visibleData}
        colors={(d) => (d as ColoredSeries).color ?? "#888"}
        margin={CHART_MARGIN}
        xScale={{ type: "linear", min: 0, max: totalSec }}
        yScale={{ type: "linear", min: 0, stacked: false }}
        axisBottom={{
          tickSize: 5,
          tickPadding: 5,
          format: (v) => `${v}s`,
          tickValues: 8,
        }}
        axisLeft={{
          tickSize: 5,
          tickPadding: 5,
          format: (v) =>
            Number(v) >= 1000 ? `${(Number(v) / 1000).toFixed(0)}k` : String(v),
          tickValues: 5,
        }}
        enablePoints={false}
        enableGridX={false}
        curve="monotoneX"
        theme={{
          background: "transparent",
          text: { fill: "#a1a1aa" },
          grid: { line: { stroke: "rgba(255,255,255,0.06)" } },
          axis: {
            ticks: { text: { fill: "#a1a1aa", fontSize: 11 } },
          },
          crosshair: { line: { stroke: "#71717a" } },
        }}
        enableCrosshair={!drag?.active}
        enableSlices={drag?.active ? false : "x"}
        sliceTooltip={(props) => <TimelineSliceTooltip {...props} seriesMeta={result.seriesMeta} />}
        layers={[
          "grid",
          "markers",
          "axes",
          overlayLayer,
          "lines",
          "crosshair",
          "slices",
        ]}
      />

      {/* Clickable legend — click to toggle series visibility */}
      <div className="absolute top-2 right-2 flex flex-col gap-0.5 select-none">
        {legendData.map((item) => (
          <button
            key={String(item.id)}
            type="button"
            className="flex items-center gap-1.5 text-[11px] leading-4 px-1 py-px rounded hover:bg-zinc-800/60 transition-colors cursor-pointer"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); toggleSeries(String(item.id)); }}
          >
            <span
              className="inline-block h-2 w-2 rounded-full shrink-0"
              style={{
                backgroundColor: item.hidden ? "transparent" : item.color,
                border: item.hidden ? `1.5px solid ${item.color}` : "none",
              }}
            />
            <span
              className="truncate max-w-[90px]"
              style={{
                color: item.hidden ? "#52525b" : "#a1a1aa",
                textDecoration: item.hidden ? "line-through" : "none",
              }}
            >
              {item.label}
            </span>
          </button>
        ))}
      </div>

      {/* Hint when time range is active */}
      {trEnabled && (
        <button
          type="button"
          onClick={() => timeRange?.reset()}
          className="absolute top-1 left-14 text-[10px] text-zinc-500 hover:text-zinc-300 cursor-pointer select-none transition-colors"
        >
          Reset Selection
        </button>
      )}
    </div>
  );
}
