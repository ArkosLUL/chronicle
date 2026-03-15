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

/** Custom series type with color for per-line coloring. */
interface ColoredSeries extends LineSeries {
  color: string;
}
import type { PanelDefinition, PanelRenderProps } from "../types";
import { timelineProcessor, type TimelineResult, type TimelineSeriesMeta } from "./timeline.processor";
import { applyAggregation } from "./aggregations";
import { TimelineFilterEditor } from "./TimelineFilterEditor";
import { getSeriesConfigs, hydrateFromPanelOption } from "./timelineTypes";

import { useTimeRangeContextOptional } from "../../TimeRangeContext";

/**
 * Create the Timeline panel definition.
 */
export function createTimelinePanel(): PanelDefinition<TimelineResult> {
  return {
    ...timelineProcessor,
    label: "Timeline",
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
              {formatValue(point.data.y as number)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Drag selection overlay (rendered as a nivo custom layer) ─────────────────

interface DragState {
  /** X pixel of drag start relative to chart inner area */
  startX: number;
  /** Current X pixel */
  currentX: number;
  active: boolean;
}

function TimelineContent({ result, durationMs, panelContext: pc, panelOption, setPanelContext }: PanelRenderProps<TimelineResult>) {
  const timeRange = useTimeRangeContextOptional();
  const containerRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  // Hydrate panelContext from saved panelOption on first render
  const hydrated = useRef(false);
  useEffect(() => {
    if (!hydrated.current && !pc?.timelineSeries && panelOption && setPanelContext) {
      const restored = hydrateFromPanelOption(panelOption);
      if (restored) {
        setPanelContext(restored);
      }
    }
    hydrated.current = true;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- intentionally runs once

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

      const points = [];
      for (let b = 0; b < totalBins; b++) {
        const val = b < displayBins.length ? displayBins[b] : 0;
        points.push({ x: (b * result.binMs) / 1000, y: val });
      }
      series.push({ id: seriesId, data: points, color: meta.color });
    }

    return series;
  }, [result, totalBins, activeSeriesIds]);

  // Pixel → ms conversion helpers using the chart's inner width
  const pxToMs = useCallback(
    (px: number, innerWidth: number) => {
      if (innerWidth <= 0 || totalBins <= 0) return 0;
      const totalMs = totalBins * result.binMs;
      return Math.max(0, Math.min(totalMs, (px / innerWidth) * totalMs));
    },
    [totalBins, result.binMs],
  );

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only primary button
    if (e.button !== 0) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    setDrag({ startX: x, currentX: x, active: true });
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!drag?.active) return;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      setDrag((prev) => (prev ? { ...prev, currentX: x } : null));
    },
    [drag?.active],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!drag?.active || !timeRange) {
        setDrag(null);
        return;
      }
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const innerWidth = rect.width;
      const startMs = pxToMs(Math.min(drag.startX, drag.currentX), innerWidth);
      const endMs = pxToMs(Math.max(drag.startX, drag.currentX), innerWidth);

      // Only set range if drag is at least 5px wide
      if (Math.abs(drag.currentX - drag.startX) > 5) {
        timeRange.setRange(Math.round(startMs), Math.round(endMs));
      }
      setDrag(null);
    },
    [drag, timeRange, pxToMs],
  );

  const handleDoubleClick = useCallback(() => {
    timeRange?.reset();
  }, [timeRange]);

  // Custom nivo layer to render the current time range highlight
  const trEnabled = timeRange?.enabled ?? false;
  const trStart = timeRange?.startOffsetMs ?? null;
  const trEnd = timeRange?.endOffsetMs ?? null;
  const totalChartMs = totalBins * result.binMs;

  const highlightLayer = useCallback(
    ({ innerWidth, innerHeight }: LineCustomSvgLayerProps<ColoredSeries>) => {
      if (!trEnabled || trStart == null || trEnd == null || totalChartMs <= 0) {
        return null;
      }

      const x1 = (trStart / totalChartMs) * innerWidth;
      const x2 = (trEnd / totalChartMs) * innerWidth;

      return (
        <rect
          x={Math.min(x1, x2)}
          y={0}
          width={Math.abs(x2 - x1)}
          height={innerHeight}
          fill="rgba(59, 130, 246, 0.15)"
          stroke="rgba(59, 130, 246, 0.5)"
          strokeWidth={1}
        />
      );
    },
    [trEnabled, trStart, trEnd, totalChartMs],
  );

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No data for selected encounters
      </div>
    );
  }

  // Compute the drag selection rect for the overlay
  const dragLeft = drag?.active ? Math.min(drag.startX, drag.currentX) : 0;
  const dragWidth = drag?.active ? Math.abs(drag.currentX - drag.startX) : 0;

  return (
    <div
      className="relative w-full"
      style={{ height: 300, cursor: "crosshair" }}
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      <ResponsiveLine
        data={data}
        colors={(d) => (d as ColoredSeries).color ?? "#888"}
        margin={{ top: 10, right: 20, bottom: 36, left: 50 }}
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
        enableCrosshair={true}
        enableSlices="x"
        sliceTooltip={(props) => <TimelineSliceTooltip {...props} seriesMeta={result.seriesMeta} />}
        layers={[
          "grid",
          "markers",
          "axes",
          highlightLayer,
          "lines",
          "crosshair",
          "slices",
          "legends",
        ]}
        legends={[
          {
            anchor: "top-right",
            direction: "column",
            itemWidth: 100,
            itemHeight: 16,
            itemTextColor: "#a1a1aa",
            symbolSize: 8,
            symbolShape: "circle",
            translateX: 10,
          },
        ]}
      />

      {/* Hint when time range is active */}
      {trEnabled && (
        <div className="absolute top-1 left-14 text-[10px] text-zinc-500 pointer-events-none select-none">
          Double-click to reset selection
        </div>
      )}

      {/* Transparent overlay for drag-to-select.
          pointer-events: none when idle so nivo slice tooltips work.
          Becomes active on mousedown (captured on the container). */}
      <div
        className="absolute inset-0"
        style={{
          marginTop: 10,
          marginBottom: 36,
          marginLeft: 50,
          marginRight: 20,
          cursor: drag?.active ? "col-resize" : undefined,
          pointerEvents: drag?.active ? "auto" : "none",
        }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Drag selection rectangle */}
        {drag?.active && dragWidth > 2 && (
          <div
            className="absolute top-0 bottom-0 bg-blue-500/20 border border-blue-500/50 pointer-events-none"
            style={{
              left: dragLeft,
              width: dragWidth,
            }}
          />
        )}
      </div>
    </div>
  );
}
