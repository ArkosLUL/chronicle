/**
 * UptimeTimeline - Renders a horizontal bar with segments showing when an aura was active
 */

import { cn } from "@/lib/utils";
import { HintTooltip, TooltipTrigger, TooltipContent } from "@/components/ui/Tooltip/tooltip";
import type { UptimeSegment } from "./auraUptime.processor";

/** Extended segment with optional metadata for tooltips */
export interface DisplaySegment extends UptimeSegment {
  /** Encounter name for tooltip */
  encounterName?: string;
  /** Gap before this segment in ms (for gap visualization) */
  gapBeforeMs?: number;
}

interface UptimeTimelineProps {
  segments: DisplaySegment[];
  totalDurationMs: number;
  className?: string;
  /** Height variant */
  size?: "sm" | "md";
  /** Show duration label at end */
  showDuration?: boolean;
}

/**
 * Format milliseconds to a readable time string (m:ss or s.Xs for short durations)
 */
function formatTimeRange(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  if (minutes === 0) {
    // Show decimal for sub-10s durations
    return totalSeconds < 10 ? `${totalSeconds.toFixed(1)}s` : `${Math.floor(seconds)}s`;
  }
  return `${minutes}:${Math.floor(seconds).toString().padStart(2, "0")}`;
}

/**
 * Format duration in a human-friendly way
 */
function formatDuration(ms: number): string {
  const totalSeconds = ms / 1000;
  if (totalSeconds < 1) {
    return `${Math.round(ms)}ms`;
  }
  if (totalSeconds < 10) {
    return `${totalSeconds.toFixed(1)}s`;
  }
  if (totalSeconds < 60) {
    return `${Math.floor(totalSeconds)}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

/**
 * Inline timeline bar for table rows (compact)
 */
export function UptimeTimeline({ 
  segments, 
  totalDurationMs, 
  className, 
  size = "sm",
}: UptimeTimelineProps) {
  if (totalDurationMs <= 0) return null;

  const height = size === "sm" ? "h-3" : "h-5";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Timeline bar with visible background */}
      <div className={cn("relative bg-foreground/20 rounded-sm overflow-hidden flex-1", height)}>
        {segments.map((seg, i) => {
          const left = (seg.startMs / totalDurationMs) * 100;
          const width = ((seg.endMs - seg.startMs) / totalDurationMs) * 100;
          const durationMs = seg.endMs - seg.startMs;
          
          // Skip very tiny segments that would be invisible
          if (width < 0.1) return null;
          
          return (
            <HintTooltip key={`${seg.startMs}-${seg.endMs}-${i}`} delayDuration={50}>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "absolute top-0 bottom-0 bg-yellow-500 transition-all duration-75 cursor-default",
                    "hover:brightness-125 hover:z-10"
                  )}
                  style={{
                    left: `${Math.max(0, Math.min(left, 100))}%`,
                    width: `${Math.max(0.5, Math.min(width, 100 - left))}%`,
                  }}
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs bg-card text-card-foreground" hideArrow>
                <div className="space-y-0.5">
                  {/* Duration */}
                  <div className="font-medium">
                    ⏱ {formatDuration(durationMs)}
                  </div>
                  {/* Time range */}
                  <div className="text-muted-foreground">
                    {formatTimeRange(seg.startMs)} → {formatTimeRange(seg.endMs)}
                  </div>
                  {/* Encounter name if available */}
                  {seg.encounterName && (
                    <div className="text-muted-foreground">
                      {seg.encounterName}
                    </div>
                  )}
                  {/* Gap before if significant */}
                  {seg.gapBeforeMs != null && seg.gapBeforeMs > 1000 && (
                    <div className="text-muted-foreground/70 text-2xs pt-0.5 border-t border-border/50">
                      Gap before: {formatDuration(seg.gapBeforeMs)}
                    </div>
                  )}
                </div>
              </TooltipContent>
            </HintTooltip>
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
