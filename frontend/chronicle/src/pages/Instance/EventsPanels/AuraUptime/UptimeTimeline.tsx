/**
 * UptimeTimeline - Renders a horizontal bar with segments showing when an aura was active
 */

import { cn } from "@/lib/utils";
import type { UptimeSegment } from "./auraUptime.processor";

interface UptimeTimelineProps {
  segments: UptimeSegment[];
  totalDurationMs: number;
  className?: string;
  /** Height variant */
  size?: "sm" | "md";
  /** Show duration label at end */
  showDuration?: boolean;
}

/**
 * Inline timeline bar for table rows (compact)
 */
export function UptimeTimeline({ segments, totalDurationMs, className, size = "sm"}: UptimeTimelineProps) {
  if (totalDurationMs <= 0) return null;

  const height = size === "sm" ? "h-3" : "h-5";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Timeline bar with visible background */}
      <div className={cn("relative bg-foreground/20 rounded-sm overflow-hidden flex-1", height)}>
        {segments.map((seg, i) => {
          const left = (seg.startMs / totalDurationMs) * 100;
          const width = ((seg.endMs - seg.startMs) / totalDurationMs) * 100;
          
          // Skip very tiny segments that would be invisible
          if (width < 0.1) return null;
          
          return (
            <div
              key={`${seg.startMs}-${seg.endMs}-${i}`}
              className="absolute top-0 bottom-0 bg-yellow-500"
              style={{
                left: `${Math.max(0, Math.min(left, 100))}%`,
                width: `${Math.max(0.5, Math.min(width, 100 - left))}%`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

interface TimelineWithMarkersProps {
  segments: UptimeSegment[];
  totalDurationMs: number;
  className?: string;
  /** Player name for the label */
  playerName?: string;
  /** Color for the segments */
  color?: string;
}

/**
 * Format milliseconds to a readable time string
 */
function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  if (minutes === 0) {
    return `${seconds}s`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Calculate good tick intervals based on duration
 */
function getTickInterval(durationMs: number): number {
  const durationSec = durationMs / 1000;
  
  if (durationSec <= 30) return 5000;      // 5s ticks for < 30s
  if (durationSec <= 60) return 10000;     // 10s ticks for < 1m
  if (durationSec <= 120) return 15000;    // 15s ticks for < 2m
  if (durationSec <= 300) return 30000;    // 30s ticks for < 5m
  if (durationSec <= 600) return 60000;    // 1m ticks for < 10m
  return 120000;                           // 2m ticks for longer
}

/**
 * Large timeline with time markers - used in expanded view
 */
export function TimelineWithMarkers({ 
  segments, 
  totalDurationMs, 
  className,
  playerName,
  color = "rgb(234 179 8)", // yellow-500
}: TimelineWithMarkersProps) {
  if (totalDurationMs <= 0) return null;

  const tickInterval = getTickInterval(totalDurationMs);
  const ticks: number[] = [];
  for (let t = 0; t <= totalDurationMs; t += tickInterval) {
    ticks.push(t);
  }
  // Always include the end if not already there
  if (ticks[ticks.length - 1] < totalDurationMs) {
    ticks.push(totalDurationMs);
  }

  return (
    <div className={cn("space-y-1", className)}>
      {/* Player label if provided */}
      {playerName && (
        <div className="text-xs font-medium truncate" style={{ color }}>
          {playerName}
        </div>
      )}
      
      {/* Timeline bar */}
      <div className="relative h-6 bg-muted/30 rounded overflow-hidden">
        {segments.map((seg, i) => {
          const left = (seg.startMs / totalDurationMs) * 100;
          const width = ((seg.endMs - seg.startMs) / totalDurationMs) * 100;
          
          if (width < 0.1) return null;
          
          return (
            <div
              key={`${seg.startMs}-${seg.endMs}-${i}`}
              className="absolute top-0 bottom-0 opacity-80"
              style={{
                left: `${Math.max(0, Math.min(left, 100))}%`,
                width: `${Math.max(0.5, Math.min(width, 100 - left))}%`,
                backgroundColor: color,
              }}
            />
          );
        })}
        
        {/* Tick marks (inside the bar) */}
        {ticks.slice(1, -1).map((t) => {
          const left = (t / totalDurationMs) * 100;
          return (
            <div
              key={t}
              className="absolute top-0 bottom-0 w-px bg-background/40"
              style={{ left: `${left}%` }}
            />
          );
        })}
      </div>
      
      {/* Time labels */}
      <div className="relative h-4 text-2xs text-muted-foreground">
        {ticks.map((t, i) => {
          const left = (t / totalDurationMs) * 100;
          const isFirst = i === 0;
          const isLast = i === ticks.length - 1;
          
          return (
            <span
              key={t}
              className="absolute whitespace-nowrap"
              style={{
                left: `${left}%`,
                transform: isFirst ? "translateX(0)" : isLast ? "translateX(-100%)" : "translateX(-50%)",
              }}
            >
              {formatTime(t)}
            </span>
          );
        })}
      </div>
    </div>
  );
}
