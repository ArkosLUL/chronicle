import { useMemo, useState } from "react";
import { Swords, Shield, Skull } from "lucide-react";
import { useInstanceDamageSummary } from "@/api/queries";
import type { InstancePlayer } from "@/api/typesGenerated";
import { Card } from "@/components/ui/Card/Card";
import { PlayerMetricChart, type PlayerMetricChartData } from "@/components/ui/PlayerMetricChart/PlayerMetricChart";
import { PANEL_CONFIGS, PANEL_OPTIONS, type PanelType } from "./panelConfig";
import type { Encounter } from "./InstancePage";

// ============================================================================
// Formatting helpers
// ============================================================================

function formatDamageNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toFixed(1).toLocaleString();
}

// Icons for each panel type
const PANEL_ICONS: Record<PanelType, React.ReactNode> = {
  damage_done: <Swords className="h-4 w-4" />,
  damage_taken: <Shield className="h-4 w-4" />,
  enemy_damage_done: <Skull className="h-4 w-4" />,
  enemy_damage_taken: <Skull className="h-4 w-4" />,
};

// ============================================================================
// MetricPanel component
// ============================================================================

export interface MetricPanelProps {
  instanceId: string;
  panelType: PanelType;
  onPanelTypeChange: (type: PanelType) => void;
  durationMs: number;
  players: Record<string, InstancePlayer>;
  enemies: Map<string, string>;
  selectedPlayerIds: Set<string>;
  selectedEnemyIds: Set<string>;
  selectedEncounters: Encounter[];
}

export function MetricPanel({ 
  instanceId,
  panelType, 
  onPanelTypeChange, 
  durationMs,
  players,
  enemies,
  selectedPlayerIds,
  selectedEnemyIds,
  selectedEncounters,
}: MetricPanelProps) {
  const [perSecond, setPerSecond] = useState(false);
  const config = PANEL_CONFIGS[panelType];
  const icon = PANEL_ICONS[panelType];
  
  // Fetch damage summary data - will use React Query cache if already fetched
  const { data: fetchedData } = useInstanceDamageSummary(instanceId, {
  });


  const encounterFiltered = useMemo(() => {
    if (!fetchedData) return [];

    return fetchedData.filter(record => {
      return selectedEncounters.find(encounter => encounter.id === record.encounter_id);
    }); 
  }, [fetchedData, selectedEncounters]);

  // Transform the data based on panel type and selection
  const data: PlayerMetricChartData[] = useMemo(() => {
    return config.transform(panelType, encounterFiltered, players, enemies, selectedPlayerIds, selectedEnemyIds);
  }, [panelType, config, encounterFiltered, players, enemies, selectedPlayerIds, selectedEnemyIds]);

  // Create combined target names map (players + enemies)
  const targetNames = useMemo(() => {
    const map = new Map<string, string>();
    // Add player names
    for (const [guid, player] of Object.entries(players)) {
      map.set(guid, player.name);
    }
    // Add enemy names
    for (const [guid, name] of enemies) {
      map.set(guid, name);
    }
    return map;
  }, [players, enemies]);

  // Show per-second toggle for damage-related panels
  const showPerSecondToggle = config.chartType === 'damage';

  // Calculate total (exclude dimmed items if filtering is active)
  const totalValue = data
    .filter(d => !d.dimmed)
    .reduce((sum, d) => sum + d.value, 0);
  
  // Format the total based on perSecond setting
  const displayTotal = perSecond 
    ? formatDamageNumber(totalValue / durationMs * 1000)
    : formatDamageNumber(totalValue);

  return (
    <Card className="p-4 gap-2">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-medium flex items-center gap-2">
          {icon}
          <select
            value={panelType}
            onChange={(e) => onPanelTypeChange(e.target.value as PanelType)}
            className="text-sm font-medium bg-transparent cursor-pointer hover:text-muted-foreground"
          >
            {PANEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </h3>
        <div className="flex items-center gap-3">
          {showPerSecondToggle && (
            <label className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground hover:text-foreground">
              <input
                type="checkbox"
                checked={perSecond}
                onChange={(e) => setPerSecond(e.target.checked)}
                className="w-3.5 h-3.5 cursor-pointer"
              />
              Per second
            </label>
          )}
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        Total: <span className="font-medium text-foreground">{displayTotal}{perSecond ? '/s' : ''}</span>
      </div>
      <PlayerMetricChart
        data={data}
        type={config.chartType}
        duration_millis={durationMs}
        perSecond={perSecond}
        style={{ height: "400px" }}
        panelTitle={config.label}
        targetNames={targetNames}
      />
    </Card>
  );
}
