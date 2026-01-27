import { useMemo, useState } from "react";
import { Swords, Shield, Activity } from "lucide-react";
import type { InstancePlayer } from "@/api/typesGenerated";
import { Card } from "@/components/ui/Card/Card";
import { type PlayerMetricChartData } from "@/components/ui/PlayerMetricChart/PlayerMetricChart";
import { useWorkerAggregation } from "@/hooks/instanceEvents";
import type { AggregationType } from "@/workers/damageAggregator.worker";
import type { Encounter } from "./InstancePage";

// ============================================================================
// Types
// ============================================================================

type EventsPanelType = "damage_done" | "damage_taken" | "healing_done" | "all_activity";

interface PanelConfig {
  label: string;
  aggregationType: AggregationType;
  chartType: "damage" | "healing" | "activity";
}

const PANEL_CONFIGS: Record<EventsPanelType, PanelConfig> = {
  damage_done: {
    label: "Damage Done",
    aggregationType: "damage_done",
    chartType: "damage",
  },
  damage_taken: {
    label: "Damage Taken", 
    aggregationType: "damage_taken",
    chartType: "damage",
  },
  healing_done: {
    label: "Healing Done",
    aggregationType: "healing_done",
    chartType: "healing",
  },
  all_activity: {
    label: "All Activity",
    aggregationType: "all_activity",
    chartType: "activity",
  },
};

const PANEL_OPTIONS: { value: EventsPanelType; label: string }[] = [
  { value: "damage_done", label: "Damage Done" },
  { value: "damage_taken", label: "Damage Taken" },
  { value: "healing_done", label: "Healing Done" },
  { value: "all_activity", label: "All Activity (3 streams)" },
];

const PANEL_ICONS: Record<EventsPanelType, React.ReactNode> = {
  damage_done: <Swords className="h-4 w-4" />,
  damage_taken: <Shield className="h-4 w-4" />,
  healing_done: <Activity className="h-4 w-4" />,
  all_activity: <Activity className="h-4 w-4" />,
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

  // List of selected encounter IDs for the worker
  const encounterIds = useMemo(
    () => selectedEncounters.map((e) => e.id),
    [selectedEncounters]
  );

  // Use the worker aggregation hook
  const { 
    loading, 
    processing, 
    error, 
    aggregatedData, 
    totalEvents,
    processingTimeMs,
    progress,
  } = useWorkerAggregation({
    aggregationType: config.aggregationType,
    encounterIds,
  });

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
  const bytesProgressPercent = progress && progress.bytesTotal > 0 
    ? (progress.bytesProcessed / progress.bytesTotal) * 100 
    : 0;
  const eventsProgressPercent = progress && progress.totalEvents > 0 
    ? (progress.currentIdx / progress.totalEvents) * 100 
    : 0;

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
          {/* Loading indicator */}
          {loading && (
            <div className="text-xs text-muted-foreground">Fetching data...</div>
          )}
          
          {/* Bytes progress */}
          {progress && (
            <div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Bytes</span>
                <span>
                  {formatNumber(progress.bytesProcessed)} / {formatNumber(progress.bytesTotal)} ({formatPercent(bytesProgressPercent / 100)})
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-150"
                  style={{ width: `${bytesProgressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Events progress */}
          {progress && (
            <div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Processing Events</span>
                <span>
                  {formatNumber(progress.currentIdx)} / {formatNumber(progress.totalEvents)} (
                  {formatPercent(eventsProgressPercent / 100)})
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5">
                <div
                  className="bg-primary h-1.5 rounded-full transition-all duration-150"
                  style={{ width: `${eventsProgressPercent}%` }}
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
          <span className="ml-2">({data.length} entries, {formatNumber(totalEvents)} events)</span>
        )}
        {processingTimeMs !== null && (
          <span className="ml-2 text-blue-500">
            Processed in {processingTimeMs.toFixed(0)}ms
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
