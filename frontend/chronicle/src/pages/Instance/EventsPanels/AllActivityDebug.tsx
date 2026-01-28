/**
 * All Activity Debug panel - Shows raw events with stream type toggles
 */

import { useState } from "react";
import { Activity, Swords, Heart, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { ScrollArea, ScrollBar } from "@/components/ui/ScrollArea/ScrollArea";
import type { PanelDefinition, PanelRenderProps } from "./types";
import { allActivityProcessor, type AllActivityState, type RawDebugEvent, type EncounterMeta } from "./processors";
import type { StreamType } from "@/hooks/instanceEvents";

// Stream type configurations
const STREAM_CONFIG: Record<StreamType, { icon: React.ElementType; color: string; label: string }> = {
  damage: { icon: Swords, color: "text-red-500", label: "Damage" },
  heal: { icon: Heart, color: "text-green-500", label: "Healing" },
  resource_change: { icon: Zap, color: "text-yellow-500", label: "Resource" },
  extra_attack: { icon: Swords, color: "text-orange-500", label: "Extra Attack" },
  slain: { icon: Activity, color: "text-gray-500", label: "Slain" },
};

interface StreamToggleProps {
  streamType: StreamType;
  enabled: boolean;
  count: number;
  onToggle: () => void;
}

function StreamToggle({ streamType, enabled, count, onToggle }: StreamToggleProps) {
  const config = STREAM_CONFIG[streamType];
  const Icon = config.icon;
  
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex items-center gap-1 px-2 py-1 rounded text-xs transition-all cursor-pointer",
        enabled 
          ? `${config.color} bg-muted` 
          : "text-muted-foreground/50 hover:text-muted-foreground"
      )}
      title={`${config.label}: ${formatNumber(count)} events`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className={cn("font-mono", !enabled && "line-through")}>{formatNumber(count)}</span>
    </button>
  );
}

interface RawEventRowProps {
  event: RawDebugEvent;
  index: number;
}

function RawEventRow({ event, index }: RawEventRowProps) {
  const config = STREAM_CONFIG[event.streamType];
  const Icon = config.icon;
  
  // Format timestamp as +XXXms
  const timeStr = `+${event.offsetMilli.toString().padStart(6, ' ')}ms`;
  
  return (
    <div className="flex items-center gap-2 text-xs font-mono py-0.5 border-b border-border/30 hover:bg-muted/30">
      <span className="text-muted-foreground w-6 text-right shrink-0">{index}</span>
      <Icon className={cn("h-3 w-3 shrink-0", config.color)} />
      <span className="text-muted-foreground w-20 shrink-0">{timeStr}</span>
      <span className="text-blue-400 w-24 shrink-0 truncate" title={event.sourceName}>{event.sourceName}</span>
      <span className="text-muted-foreground shrink-0">→</span>
      <span className="text-purple-400 w-24 shrink-0 truncate" title={event.target}>{event.target}</span>
      <span className={cn("w-12 text-right shrink-0", config.color)}>{formatNumber(event.amount)}</span>
      {/* {event.extra && (
        <span className="text-muted-foreground/70 text-[10px] shrink-0">{event.extra}</span>
      )} */}
    </div>
  );
}

function AllActivityRender({
  result,
  totalEvents,
  processingTimeMs,
  loading,
  processing,
  error,
}: PanelRenderProps<AllActivityState>) {
  // Track which streams are visible
  const [enabledStreams, setEnabledStreams] = useState<Set<StreamType>>(
    new Set(["damage", "heal", "resource_change"])
  );
  
  // Configurable display limit
  const [displayLimit, setDisplayLimit] = useState(100);
  
  const toggleStream = (stream: StreamType) => {
    setEnabledStreams((prev) => {
      const next = new Set(prev);
      if (next.has(stream)) {
        next.delete(stream);
      } else {
        next.add(stream);
      }
      return next;
    });
  };
  
  // Default state during loading
  const emptyByStream = { damage: [], heal: [], resource_change: [], extra_attack: [], slain: [] };
  const emptyEncounters = new Map<string, EncounterMeta>();
  const safeResult = result ?? {
    counts: new Map<string, number>(),
    rawEventsByStream: emptyByStream,
    streamCounts: { damage: 0, heal: 0, resource_change: 0, extra_attack: 0, slain: 0 },
    encounters: emptyEncounters,
  };
  
  // Get encounters map (handle both Map and deserialized object)
  // After worker serialization, Maps become objects with __serializedMap__ marker
  // After usePanelAggregation deserializes, it should be a Map again
  const encounters: Map<string, EncounterMeta> = safeResult.encounters instanceof Map 
    ? safeResult.encounters 
    : new Map<string, EncounterMeta>();
  
  // Merge enabled streams and sort by index to show true interleaving
  const rawEventsByStream = safeResult.rawEventsByStream ?? emptyByStream;
  const enabledEvents = [
    ...(enabledStreams.has("damage") ? rawEventsByStream.damage : []),
    ...(enabledStreams.has("heal") ? rawEventsByStream.heal : []),
    ...(enabledStreams.has("resource_change") ? rawEventsByStream.resource_change : []),
  ];
  
  // Sort by index to reconstruct true event order
  const sortedEvents = enabledEvents.sort((a, b) => a.index - b.index);
  const filteredEvents = sortedEvents.slice(0, displayLimit);
  
  // Count total captured across all streams
  const totalCaptured = rawEventsByStream.damage.length + 
    rawEventsByStream.heal.length + 
    rawEventsByStream.resource_change.length;

  if (loading) {
    return <div className="text-xs text-muted-foreground">Fetching data...</div>;
  }

  if (processing) {
    return <div className="text-xs text-muted-foreground">Processing...</div>;
  }

  if (error) {
    return <div className="text-xs text-destructive">Error: {error.message}</div>;
  }

  return (
    <div>
      {/* Stream toggles */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Streams:</span>
        {(["damage", "heal", "resource_change"] as StreamType[]).map((stream) => (
          <StreamToggle
            key={stream}
            streamType={stream}
            enabled={enabledStreams.has(stream)}
            count={safeResult.streamCounts[stream]}
            onToggle={() => toggleStream(stream)}
          />
        ))}
      </div>
      
      {/* Stats and limit control */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2 flex-wrap">
        <span>
          Total Events: <span className="font-medium text-foreground">{formatNumber(totalEvents)}</span>
        </span>
        <span>
          Captured: <span className="font-medium text-foreground">{formatNumber(totalCaptured)}</span>
        </span>
        <span>
          Showing: <span className="font-medium text-foreground">{filteredEvents.length}</span> of {formatNumber(sortedEvents.length)} enabled
        </span>
        <label className="flex items-center gap-1">
          Limit:
          <input
            type="number"
            value={displayLimit}
            onChange={(e) => setDisplayLimit(Math.max(1, Math.min(1000, parseInt(e.target.value) || 100)))}
            className="w-16 px-1 py-0.5 text-xs bg-muted border rounded text-foreground"
            min={1}
            max={1000}
          />
        </label>
        {processingTimeMs !== null && (
          <span className="text-blue-500">
            ({processingTimeMs.toFixed(0)}ms)
          </span>
        )}
      </div>
      
      {/* Raw events list */}
      <ScrollArea className="h-80 border rounded">
        <div className="p-1 min-w-max">
          {/* Header */}
          <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground py-1 border-b sticky top-0 bg-background">
            <span className="w-6 text-right shrink-0">#</span>
            <span className="w-3 shrink-0"></span>
            <span className="w-20 shrink-0">Time</span>
            <span className="w-24 shrink-0">Source</span>
            <span className="shrink-0"></span>
            <span className="w-24 shrink-0">Target</span>
            <span className="w-12 text-right shrink-0">Amount</span>
            {/* <span className="shrink-0">Extra</span> */}
          </div>
          
          {filteredEvents.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">
              No events to display. Enable some streams.
            </div>
          ) : (
            (() => {
              let lastEncounterID: string | null = null;
              return filteredEvents.map((event, idx) => {
                const showHeader = event.encounterID !== lastEncounterID;
                lastEncounterID = event.encounterID;
                const encounterMeta = encounters.get(event.encounterID);
                const timestamp = encounterMeta 
                  ? new Date(encounterMeta.firstTimestamp).toLocaleTimeString()
                  : "???";
                
                return (
                  <div key={`${event.streamType}-${event.index}`}>
                    {showHeader && (
                      <div className="flex items-center gap-2 text-[10px] font-semibold text-cyan-400 py-1 mt-1 border-t border-cyan-400/30 bg-cyan-400/5">
                        <span className="px-1">📍 Encounter: {event.encounterID.slice(0, 8)}... @ {timestamp}</span>
                      </div>
                    )}
                    <RawEventRow event={event} index={idx} />
                  </div>
                );
              });
            })()
          )}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const AllActivityPanel: PanelDefinition<AllActivityState, any> = {
  ...allActivityProcessor,
  label: "All Activity",
  icon: <Activity className="h-4 w-4" />,
  
  render: (props: PanelRenderProps<AllActivityState>) => (
    <AllActivityRender {...props} />
  ),
};
