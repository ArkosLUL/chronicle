/**
 * PeriodsPanel - Timeline visualization of unit activity periods
 * 
 * Shows activity periods for hostiles across selected encounters.
 * Period data comes from the instance API (no event stream processing needed).
 */
/* eslint-disable react-refresh/only-export-components */

import { useMemo } from "react";
import { Clock } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/ScrollArea/ScrollArea";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/Tooltip/tooltip";
import { cn } from "@/lib/utils";
import type { PanelDefinition, PanelRenderProps, PanelContext } from "../types";
import type { ActivityPeriod } from "@/api/typesGenerated";

// Periods panel doesn't process event streams - it reads from context
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface PeriodsState {
  // Empty - all data comes from context.instance.encounters
}

interface TimelineEntry {
  guid: string;
  name: string;
  boss: boolean;
  encounterID: string;
  encounterName: string;
  periods: readonly ActivityPeriod[];
  encounterStart: number;  // ms timestamp
  encounterEnd: number;    // ms timestamp
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString();
}

function PeriodsTimeline({ context }: { context: PanelContext }) {
  // Extract all hostiles with periods from selected encounters
  const timelineData = useMemo(() => {
    const entries: TimelineEntry[] = [];
    
    for (const encounter of context.instance.encounters) {
      if (!context.selectedEncounterIds.includes(encounter.id)) continue;
      
      const encStart = new Date(encounter.start_time).getTime();
      const encEnd = new Date(encounter.end_time).getTime();
      
      for (const enemy of encounter.enemies ?? []) {
        if (enemy.periods.length > 0) {
          entries.push({
            guid: enemy.id,
            name: enemy.name,
            boss: enemy.boss,
            encounterID: encounter.id,
            encounterName: encounter.name,
            periods: enemy.periods,
            encounterStart: encStart,
            encounterEnd: encEnd,
          });
        }
      }
    }
    
    // Sort: bosses first, then by name
    entries.sort((a, b) => {
      if (a.boss !== b.boss) return a.boss ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    
    return entries;
  }, [context.instance.encounters, context.selectedEncounterIds]);

  // Compute global time range for scaling
  const { minTime, maxTime } = useMemo(() => {
    let min = Infinity, max = -Infinity;
    for (const entry of timelineData) {
      min = Math.min(min, entry.encounterStart);
      max = Math.max(max, entry.encounterEnd);
    }
    return { minTime: min, maxTime: max };
  }, [timelineData]);

  const totalDuration = maxTime - minTime;

  if (timelineData.length === 0) {
    return (
      <div className="text-xs text-muted-foreground text-center py-8">
        No period data for selected encounters.
        <br />
        <span className="text-muted-foreground/70">
          Period data shows when hostile units are active during encounters.
        </span>
      </div>
    );
  }

  return (
    <ScrollArea className="h-80">
      <div className="p-2 min-w-max">
        {/* Header */}
        <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground mb-2 border-b pb-1">
          <span className="w-32 shrink-0">Unit</span>
          <span className="w-20 shrink-0 text-center">Enc.</span>
          <span className="flex-1 min-w-[300px]">
            Activity Timeline
            <span className="ml-2 text-muted-foreground/50">
              ({formatDuration(totalDuration)} total)
            </span>
          </span>
        </div>
        
        {timelineData.map((entry, entryIdx) => (
          <div 
            key={`${entry.encounterID}-${entry.guid}-${entryIdx}`} 
            className="flex items-center gap-2 py-1 border-b border-border/30 hover:bg-muted/20"
          >
            {/* Unit name */}
            <span 
              className={cn(
                "w-32 text-xs truncate shrink-0",
                entry.boss ? "text-yellow-400 font-medium" : "text-muted-foreground"
              )}
              title={`${entry.name} (${entry.guid})`}
            >
              {entry.name}
            </span>
            
            {/* Encounter indicator */}
            <span className="w-20 text-[10px] text-muted-foreground truncate shrink-0 text-center" title={entry.encounterName}>
              {entry.encounterName.slice(0, 8)}...
            </span>
            
            {/* Timeline bar container */}
            <div className="flex-1 h-5 bg-muted/30 rounded relative min-w-[300px]">
              {/* Encounter boundary markers */}
              {(() => {
                const encLeft = ((entry.encounterStart - minTime) / totalDuration) * 100;
                const encWidth = ((entry.encounterEnd - entry.encounterStart) / totalDuration) * 100;
                return (
                  <div
                    className="absolute h-full border-l border-r border-muted-foreground/30"
                    style={{ left: `${encLeft}%`, width: `${encWidth}%` }}
                  />
                );
              })()}
              
              {/* Period bars */}
              {entry.periods.map((period, idx) => {
                const start = period.start 
                  ? new Date(period.start.timestamp).getTime() 
                  : entry.encounterStart;
                const end = period.end 
                  ? new Date(period.end.timestamp).getTime() 
                  : entry.encounterEnd;
                const left = ((start - minTime) / totalDuration) * 100;
                const width = ((end - start) / totalDuration) * 100;
                
                const tooltipContent = (
                  <div className="text-xs space-y-0.5">
                    <div className="font-medium">{entry.name}</div>
                    <div className="opacity-80">
                      Start: {period.start ? `${formatTime(period.start.timestamp)} (${period.start.reason})` : "encounter start"}
                    </div>
                    <div className="opacity-80">
                      End: {period.end ? `${formatTime(period.end.timestamp)} (${period.end.reason})` : "ongoing"}
                    </div>
                    {period.last_active && (
                      <div className="opacity-80">
                        Last Active: {formatTime(period.last_active.timestamp)} ({period.last_active.reason})
                      </div>
                    )}
                    <div className="pt-1 font-medium">
                      Duration: {formatDuration(end - start)}
                    </div>
                    {period.slain && (
                      <div className="text-red-400 pt-1">💀 Slain</div>
                    )}
                  </div>
                );
                
                return (
                  <Tooltip key={idx}>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          "absolute h-full rounded cursor-help transition-opacity hover:opacity-100",
                          entry.boss ? "bg-yellow-500/70" : "bg-blue-500/50",
                          period.slain && "border-r-2 border-red-500"
                        )}
                        style={{ 
                          left: `${left}%`, 
                          width: `${Math.max(width, 0.5)}%`,
                          opacity: 0.8,
                        }}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs bg-popover text-popover-foreground">
                      {tooltipContent}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        ))}
        
        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 pt-2 border-t text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-yellow-500/70 rounded" />
            <span>Boss</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500/50 rounded" />
            <span>Trash/Add</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500/50 rounded border-r-2 border-red-500" />
            <span>Slain</span>
          </div>
        </div>
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PeriodsPanel: PanelDefinition<PeriodsState, any> = {
  id: "periods",
  streams: [],  // No streams needed - data from context
  createState: (): PeriodsState => ({}),
  processEvent: () => {},  // No-op
  label: "Periods",
  icon: <Clock className="h-4 w-4" />,
  selfManagesAggregation: true,  // Don't use worker - data from context
  render: (props: PanelRenderProps<PeriodsState>) => <PeriodsTimeline context={props.context} />,
};
