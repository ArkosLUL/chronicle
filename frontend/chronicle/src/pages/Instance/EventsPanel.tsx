/* eslint-disable react-hooks/purity */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useMemo, useState, useCallback, useRef } from "react";
import { Swords, Shield, Activity } from "lucide-react";
import type { InstancePlayer } from "@/api/typesGenerated";
import { Card } from "@/components/ui/Card/Card";
import { type PlayerMetricChartData } from "@/components/ui/PlayerMetricChart/PlayerMetricChart";
import { useInstanceEvents, type StreamType } from "@/hooks/instanceEvents";
import type { Damage } from "@/api/proto/chronicle_pb";
import type { Encounter } from "./InstancePage";

// ============================================================================
// Types
// ============================================================================

type EventsPanelType = "damage_done" | "damage_taken" | "healing_done";

interface PanelConfig {
  label: string;
  streams: StreamType[];
  chartType: "damage" | "healing";
}

const PANEL_CONFIGS: Record<EventsPanelType, PanelConfig> = {
  damage_done: {
    label: "Damage Done",
    streams: ["damage"],
    chartType: "damage",
  },
  damage_taken: {
    label: "Damage Taken", 
    streams: ["damage"],
    chartType: "damage",
  },
  healing_done: {
    label: "Healing Done",
    streams: ["heal"],
    chartType: "healing",
  },
};

const PANEL_OPTIONS: { value: EventsPanelType; label: string }[] = [
  { value: "damage_done", label: "Damage Done" },
  { value: "damage_taken", label: "Damage Taken" },
  { value: "healing_done", label: "Healing Done" },
];

const PANEL_ICONS: Record<EventsPanelType, React.ReactNode> = {
  damage_done: <Swords className="h-4 w-4" />,
  damage_taken: <Shield className="h-4 w-4" />,
  healing_done: <Activity className="h-4 w-4" />,
};

// ============================================================================
// Formatting helpers
// ============================================================================

function formatNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toFixed(0);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

// ============================================================================
// EventsPanel component
// ============================================================================

export interface EventsPanelProps {
  panelType: EventsPanelType;
  onPanelTypeChange: (type: EventsPanelType) => void;
  durationMs: number;
  players: Record<string, InstancePlayer>;
  enemies: Map<string, string>;
  selectedPlayerIds: Set<string>;
  selectedEnemyIds: Set<string>;
  selectedEncounters: Encounter[];
}

export function EventsPanel({
  panelType,
  onPanelTypeChange,
  durationMs,
  players,
  enemies,
  selectedPlayerIds,
  selectedEnemyIds,
  selectedEncounters,
}: EventsPanelProps) {
  const [perSecond, setPerSecond] = useState(false);
  const config = PANEL_CONFIGS[panelType];
  const icon = PANEL_ICONS[panelType];

  // Aggregated data from events
  const [aggregatedData, setAggregatedData] = useState<Map<string, number>>(new Map());
  
  // Ref for batching updates - accumulate here, flush every N events
  const pendingDataRef = useRef<Map<string, number>>(new Map());
  const eventCountRef = useRef(0);
  const FLUSH_INTERVAL = 500;
  // Mark as used for now (will be used when batching is re-enabled)
  void FLUSH_INTERVAL;
  
  // Timing measurement
  const startTimeRef = useRef<number | null>(null);
  const [processingTime, setProcessingTime] = useState<number | null>(null);

  // Set of selected encounter IDs for filtering
  const selectedEncounterIds = useMemo(
    () => new Set(selectedEncounters.map((e) => e.id)),
    [selectedEncounters]
  );

  // Flush pending data to state
  const flushPendingData = useCallback(() => {
    if (pendingDataRef.current.size === 0) return;
    
    setAggregatedData((prev) => {
      const next = new Map(prev);
      for (const [key, value] of pendingDataRef.current) {
        next.set(key, (next.get(key) || 0) + value);
      }
      return next;
    });
    pendingDataRef.current.clear();
  }, []);

  // Event callback - aggregates damage/healing by source or target
  const onEvent = useCallback(
    (event: unknown, streamType: StreamType, encounterID: string) => {
      // Skip events not in selected encounters
      if (!selectedEncounterIds.has(encounterID)) return;

      if (streamType === "damage") {
        const dmg = event as Damage;
        
        let key: string;
        if (panelType === "damage_done") {
          key = dmg.caster || "Unknown";
        } else if (panelType === "damage_taken") {
          key = dmg.target;
        } else {
          return;
        }
        
        // Mark as used for now (will be used when batching is re-enabled)
        void key;
        
        // // Accumulate in ref
        // pendingDataRef.current.set(
        //   key,
        //   (pendingDataRef.current.get(key) || 0) + dmg.amount
        // );
        
        // // Flush every N events
        // eventCountRef.current++;
        // if (eventCountRef.current % FLUSH_INTERVAL === 0) {
        //   flushPendingData();
        // }
      }
      // TODO: Handle heal stream for healing_done
    },
    [panelType, selectedEncounterIds, flushPendingData]
  );

  // Flush remaining data when encounter completes
  const onEncounterComplete = useCallback((encounterID: string) => {
    console.log(`[EventsPanel] Encounter ${encounterID} complete`);
    flushPendingData();
  }, [flushPendingData]);

  // Reset state and refs when deps change
  const depsKey = `${panelType}-${Array.from(selectedEncounterIds).sort().join(",")}`;
  const prevDepsKeyRef = useRef(depsKey);
  
  if (prevDepsKeyRef.current !== depsKey) {
    prevDepsKeyRef.current = depsKey;
    pendingDataRef.current.clear();
    eventCountRef.current = 0;
    setAggregatedData(new Map());
  }

  // Use the instance events hook
  const { loading, processing, error, encounterProgress, bytesProcessed, bytesTotal } =
    useInstanceEvents({
      streams: config.streams,
      onEvent,
      onEncounterComplete,
      deps: [panelType, selectedEncounterIds],
    });
  
  // Track timing
  if (processing && startTimeRef.current === null) {
    startTimeRef.current = performance.now();
  }
  
  // Final flush when processing completes
  const wasProcessingRef = useRef(false);
  if (wasProcessingRef.current && !processing && !loading) {
    flushPendingData();
    if (startTimeRef.current !== null) {
      const elapsed = performance.now() - startTimeRef.current;
      setProcessingTime(elapsed);
      console.log(`[EventsPanel] Processing took ${elapsed.toFixed(2)}ms`);
      startTimeRef.current = null;
    }
  }
  wasProcessingRef.current = processing;

  // Transform aggregated data to chart format
  const data: PlayerMetricChartData[] = useMemo(() => {
    const result: PlayerMetricChartData[] = [];
    
    for (const [id, value] of aggregatedData) {
      // Determine if this is a player or enemy
      const player = players[id];
      const enemyName = enemies.get(id);
      
      // Filter based on selection
      const isPlayer = !!player;
      const isEnemy = !!enemyName;
      
      if (isPlayer && selectedPlayerIds.size > 0 && !selectedPlayerIds.has(id)) {
        continue;
      }
      if (isEnemy && selectedEnemyIds.size > 0 && !selectedEnemyIds.has(id)) {
        continue;
      }

      result.push({
        playerID: id,
        playerName: player?.name || enemyName || id,
        value,
        className: player?.class || "Unknown",
        specialization: "",
        dimmed: false,
      });
    }

    // Sort by value descending
    return result.sort((a, b) => b.value - a.value);
  }, [aggregatedData, players, enemies, selectedPlayerIds, selectedEnemyIds]);

  // Create combined target names map (players + enemies)
  // TODO: Will be used when chart is re-enabled
  // const targetNames = useMemo(() => {
  //   const map = new Map<string, string>();
  //   for (const [guid, player] of Object.entries(players)) {
  //     map.set(guid, player.name);
  //   }
  //   for (const [guid, name] of enemies) {
  //     map.set(guid, name);
  //   }
  //   return map;
  // }, [players, enemies]);

  // Calculate total
  const totalValue = data.reduce((sum, d) => sum + d.value, 0);
  const displayTotal = perSecond
    ? formatNumber(totalValue / durationMs * 1000)
    : formatNumber(totalValue);

  // Progress display
  const progressPercent = bytesTotal > 0 ? (bytesProcessed / bytesTotal) * 100 : 0;

  return (
    <Card className="p-4 gap-2">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-medium flex items-center gap-2">
          {icon}
          <select
            value={panelType}
            onChange={(e) => onPanelTypeChange(e.target.value as EventsPanelType)}
            className="text-sm font-medium bg-transparent cursor-pointer hover:text-muted-foreground"
          >
            {PANEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground ml-2">(Events)</span>
        </h3>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            <input
              type="checkbox"
              checked={perSecond}
              onChange={(e) => setPerSecond(e.target.checked)}
              className="w-3.5 h-3.5 cursor-pointer"
            />
            Per second
          </label>
        </div>
      </div>

      {/* Progress/Status bars */}
      {(loading || processing) && (
        <div className="mb-2 space-y-2">
          {/* Bytes progress */}
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Bytes</span>
              <span>
                {formatNumber(bytesProcessed)} / {formatNumber(bytesTotal)} ({formatPercent(progressPercent / 100)})
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5">
              <div
                className="bg-blue-500 h-1.5 rounded-full transition-all duration-150"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Encounter progress */}
          {encounterProgress && (
            <div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>
                  {loading ? "Fetching..." : "Processing..."} Encounter
                </span>
                <span>
                  {encounterProgress.currentIdx} / {encounterProgress.totalEvents} (
                  {formatPercent(encounterProgress.currentIdx / encounterProgress.totalEvents)})
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5">
                <div
                  className="bg-primary h-1.5 rounded-full transition-all duration-150"
                  style={{ width: `${(encounterProgress.currentIdx / encounterProgress.totalEvents) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="text-xs text-destructive mb-2">
          Error: {error.message}
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        Total: <span className="font-medium text-foreground">{displayTotal}{perSecond ? "/s" : ""}</span>
        {!loading && !processing && (
          <span className="ml-2">({data.length} entries)</span>
        )}
        {processingTime !== null && (
          <span className="ml-2 text-blue-500">
            Processed in {processingTime.toFixed(0)}ms
          </span>
        )}
      </div>

      {/* <PlayerMetricChart
        data={data}
        type={config.chartType}
        duration_millis={durationMs}
        perSecond={perSecond}
        style={{ height: "400px" }}
        panelTitle={config.label}
        targetNames={targetNames}
      /> */}
    </Card>
  );
}
