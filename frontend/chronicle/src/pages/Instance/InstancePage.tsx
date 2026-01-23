import { useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Skull, CheckCircle, ChevronDown, ChevronRight, Clock, Swords, Shield, PanelLeftClose, PanelLeft, Loader2, Users } from "lucide-react";
import { useInstance, useInstanceDamageSummary, type EncounterDamageSummary } from "@/api/queries";
import type { Ability, ActivityPeriod, InstancePlayer, InstanceUnit, WoWEncounterWithHostiles, WoWHeroClasses } from "@/api/typesGenerated";
import { Card } from "@/components/ui/Card/Card";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/Collapsible/Collapsible";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PlayerMetricChart, type PlayerMetricChartData, type AbilityBreakdown } from "@/components/ui/PlayerMetricChart/PlayerMetricChart";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/Tooltip/tooltip";
import { cn } from "@/lib/utils";

// Types for the Instance page
export interface EnemyUnit {
  id: string;
  name: string;
  damageTaken: number; // damage taken from players
  damageDone: number;  // damage done to players
  periods: readonly ActivityPeriod[]; // activity periods for debugging
}

export interface Encounter {
  id: string;
  name: string;
  boss: boolean;
  kill: boolean;
  start_time: string;
  end_time: string;
  dps?: PlayerMetricChartData[];
  healing?: PlayerMetricChartData[];
  damageTaken?: PlayerMetricChartData[];
  enemyDamageDone?: PlayerMetricChartData[]; // damage dealt by enemies to players
  enemyDamageTaken?: PlayerMetricChartData[]; // damage taken by enemies from players
  enemies?: EnemyUnit[];
  remaining?: string[]; // GUIDs of enemies that did not die
}

export interface Instance {
  id: string;
  name: string;
  realm?: string;
  startTime: string;
  endTime?: string;
  encounters: Encounter[];
  // GUID -> player info lookup
  players?: Record<string, InstancePlayer>;
  // GUID -> unit info lookup (creatures, pets, etc.)
  units?: Record<string, InstanceUnit>;
}

interface InstancePageViewProps {
  instance: Instance;
  selectedEncounterIds?: string[];
  onSelectEncounters?: (encounterIds: string[]) => void;
  onBack?: () => void;
}

function formatDuration(startTime: string, endTime: string): string {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const durationMs = end.getTime() - start.getTime();
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleString();
}

// Format a period moment for display
function formatPeriodMoment(moment: { timestamp: string; reason: string } | undefined): string {
  if (!moment) return "N/A";
  const time = new Date(moment.timestamp).toLocaleTimeString();
  return `${time} (${moment.reason})`;
}

// Format activity periods for tooltip display
function formatPeriodsTooltip(guid: string, periods: readonly ActivityPeriod[]): React.ReactNode {
  return (
    <div className="space-y-2 max-w-xs">
      <div className="font-mono text-xs text-muted-foreground">{guid}</div>
      {(!periods || periods.length === 0) ? (
        <span className="text-muted-foreground">No activity data</span>
      ) : (
        <>
          <div className="font-medium border-b border-border pb-1">
            Activity Periods ({periods.length})
          </div>
          {periods.map((period, idx) => (
            <div key={idx} className="text-xs space-y-0.5">
              <div className="font-medium text-foreground/80">Period {idx + 1}</div>
              <div>Start: {formatPeriodMoment(period.start)}</div>
              <div>End: {formatPeriodMoment(period.end)}</div>
              <div>Last Active: {formatPeriodMoment(period.last_active)}</div>
              <div className={period.slain ? "text-green-400" : "text-red-400"}>
                {period.slain ? "✓ Slain" : "✗ Survived"}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// Group trash encounters by name
interface TrashGroup {
  name: string;
  encounters: Encounter[];
  kills: number;
  wipes: number;
}

function groupTrashEncounters(encounters: Encounter[]): TrashGroup[] {
  const trashEncounters = encounters.filter((e) => !e.boss);
  const groups = new Map<string, Encounter[]>();

  for (const encounter of trashEncounters) {
    const existing = groups.get(encounter.name) || [];
    existing.push(encounter);
    groups.set(encounter.name, existing);
  }

  return Array.from(groups.entries()).map(([name, encs]) => ({
    name,
    encounters: encs,
    kills: encs.filter((e) => e.kill).length,
    wipes: encs.filter((e) => !e.kill).length,
  }));
}

// Merge ability breakdowns from multiple sources
function mergeAbilityBreakdowns(existing: AbilityBreakdown[] | undefined, incoming: AbilityBreakdown[] | undefined): AbilityBreakdown[] {
  if (!incoming || incoming.length === 0) return existing || [];
  if (!existing || existing.length === 0) return [...incoming];
  
  const abilityMap = new Map<string, AbilityBreakdown>();
  
  // Add existing abilities
  for (const ability of existing) {
    abilityMap.set(ability.name, { ...ability });
  }
  
  // Merge incoming abilities
  for (const ability of incoming) {
    const existingAbility = abilityMap.get(ability.name);
    if (existingAbility) {
      existingAbility.totalDamage += ability.totalDamage;
      existingAbility.hitCount += ability.hitCount;
      existingAbility.critCount += ability.critCount;
      existingAbility.missCount += ability.missCount;
      existingAbility.dodgeCount += ability.dodgeCount;
      existingAbility.immuneCount += ability.immuneCount;
      existingAbility.parryCount += ability.parryCount;
      existingAbility.otherCount += ability.otherCount;
    } else {
      abilityMap.set(ability.name, { ...ability });
    }
  }
  
  return Array.from(abilityMap.values());
}

// Merge metrics from multiple encounters by summing values per unit
function mergeMetrics(encounters: Encounter[], key: 'dps' | 'healing' | 'damageTaken' | 'enemyDamageDone' | 'enemyDamageTaken'): PlayerMetricChartData[] {
  const playerMap = new Map<string, PlayerMetricChartData>();

  for (const encounter of encounters) {
    const metrics = encounter[key];
    if (!metrics) continue;

    for (const metric of metrics) {
      const existing = playerMap.get(metric.playerID);
      if (existing) {
        existing.value += metric.value;
        if (metric.stackedValue !== undefined) {
          existing.stackedValue = (existing.stackedValue || 0) + metric.stackedValue;
        }
        // Merge ability breakdowns
        existing.abilityBreakdown = mergeAbilityBreakdowns(existing.abilityBreakdown, metric.abilityBreakdown);
      } else {
        playerMap.set(metric.playerID, { 
          ...metric,
          abilityBreakdown: metric.abilityBreakdown ? [...metric.abilityBreakdown] : undefined,
        });
      }
    }
  }

  return Array.from(playerMap.values());
}

// Merged enemy with kill status and mutable periods for merging
interface MergedEnemy extends Omit<EnemyUnit, 'periods'> {
  killed: boolean;
  periods: ActivityPeriod[]; // mutable for merging across encounters
}

// Merge enemies from multiple encounters by summing damage values
function mergeEnemies(encounters: Encounter[]): MergedEnemy[] {
  const enemyMap = new Map<string, MergedEnemy>();
  // Collect all remaining GUIDs across encounters
  const remainingSet = new Set<string>();
  for (const encounter of encounters) {
    if (encounter.remaining) {
      for (const guid of encounter.remaining) {
        remainingSet.add(guid);
      }
    }
  }

  for (const encounter of encounters) {
    const enemies = encounter.enemies;
    if (!enemies) continue;

    for (const enemy of enemies) {
      const existing = enemyMap.get(enemy.id);
      
      if (existing) {
        existing.damageTaken += enemy.damageTaken;
        existing.damageDone += enemy.damageDone;
        // Concatenate periods from multiple encounters
        existing.periods = [...existing.periods, ...enemy.periods];
      } else {
        enemyMap.set(enemy.id, {
          ...enemy,
          periods: [...enemy.periods], // make mutable copy
          killed: !remainingSet.has(enemy.id),
        });
      }
    }
  }

  return Array.from(enemyMap.values()).sort((a, b) => b.damageTaken - a.damageTaken);
}

// Merged player from damage metrics
interface MergedPlayer {
  id: string;
  name: string;
  className: string;
  damageDone: number;
  damageTaken: number;
}

// Merge players from encounter metrics
function mergePlayers(encounters: Encounter[]): MergedPlayer[] {
  const playerMap = new Map<string, MergedPlayer>();

  // Get players from DPS metrics (damage done)
  const dpsData = mergeMetrics(encounters, 'dps');
  for (const d of dpsData) {
    const existing = playerMap.get(d.playerID);
    if (existing) {
      existing.damageDone += d.value;
    } else {
      playerMap.set(d.playerID, {
        id: d.playerID,
        name: d.playerName,
        className: d.className,
        damageDone: d.value,
        damageTaken: 0,
      });
    }
  }

  // Add damage taken data
  const damageTakenData = mergeMetrics(encounters, 'damageTaken');
  for (const d of damageTakenData) {
    const existing = playerMap.get(d.playerID);
    if (existing) {
      existing.damageTaken += d.value;
    } else {
      playerMap.set(d.playerID, {
        id: d.playerID,
        name: d.playerName,
        className: d.className,
        damageDone: 0,
        damageTaken: d.value,
      });
    }
  }

  return Array.from(playerMap.values()).sort((a, b) => b.damageDone - a.damageDone);
}

// Sidebar component for encounter navigation
function EncounterSidebar({
  encounters,
  trashGroups,
  selectedIds,
  onSelect,
  onCollapse,
}: {
  encounters: Encounter[];
  trashGroups: TrashGroup[];
  selectedIds: string[];
  onSelect: (id: string, mode: 'single' | 'toggle') => void;
  onCollapse: () => void;
}) {
  const bossEncounters = encounters.filter((e) => e.boss);
  const totalTrash = trashGroups.reduce((sum, g) => sum + g.encounters.length, 0);

  // Check which trash groups have selected encounters
  const groupsWithSelectedTrash = trashGroups
    .filter(g => g.encounters.some(e => selectedIds.includes(e.id)))
    .map(g => g.name);
  const hasSelectedTrash = groupsWithSelectedTrash.length > 0;

  const [trashOpen, setTrashOpen] = useState(false);
  const [manualExpandedGroup, setManualExpandedGroup] = useState<string | null>(null);

  // Keep trash expanded if any trash is selected
  const effectiveTrashOpen = trashOpen || hasSelectedTrash;
  
  // A group is expanded if manually expanded OR has a selected encounter
  const isGroupExpanded = (groupName: string) => 
    manualExpandedGroup === groupName || groupsWithSelectedTrash.includes(groupName);

  const handleClick = (id: string, e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey) {
      onSelect(id, 'toggle');
    } else {
      onSelect(id, 'single');
    }
  };

  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modifierKey = isMac ? '⌘' : 'Ctrl';

  return (
    <div className="w-64 shrink-0 border-r pr-4">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">
            Encounters
            {selectedIds.length > 1 && (
              <span className="ml-2 text-xs">({selectedIds.length} selected)</span>
            )}
          </h3>
          <p className="text-xs text-muted-foreground/60 mt-1">
            {modifierKey}+click to multi-select
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 -mr-1 -mt-1"
          onClick={onCollapse}
          title="Hide sidebar"
        >
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Boss encounters */}
      <div className="space-y-1">
        {bossEncounters.map((encounter) => {
          const isSelected = selectedIds.includes(encounter.id);
          const isWipe = !encounter.kill;
          
          return (
            <button
              key={encounter.id}
              onClick={(e) => handleClick(encounter.id, e)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition-colors",
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted",
                isWipe && !isSelected && "opacity-60"
              )}
            >
              {encounter.kill ? (
                <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
              ) : (
                <Skull className="h-4 w-4 shrink-0 text-red-500" />
              )}
              <span className="truncate flex-1">{encounter.name}</span>
              {isWipe && <span className="text-xs opacity-70">(wipe)</span>}
            </button>
          );
        })}
      </div>

      {/* Trash section */}
      {totalTrash > 0 && (
        <Collapsible open={effectiveTrashOpen} onOpenChange={setTrashOpen} className="mt-4">
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left hover:bg-muted opacity-60">
              {effectiveTrashOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <span>Trash</span>
              <span className="text-muted-foreground">({totalTrash})</span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="ml-2 mt-1 space-y-1">
              {trashGroups.map((group) => {
                const expanded = isGroupExpanded(group.name);
                return (
                <Collapsible
                  key={group.name}
                  open={expanded}
                  onOpenChange={(open) => setManualExpandedGroup(open ? group.name : null)}
                >
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center gap-2 px-3 py-1.5 rounded text-xs text-left hover:bg-muted opacity-70">
                      {expanded ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                      <span className="truncate">{group.name}</span>
                      <span className="text-muted-foreground">
                        x{group.encounters.length}
                        {group.wipes > 0 && ` (${group.wipes}💀)`}
                      </span>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-4 space-y-0.5">
                      {group.encounters.map((encounter, idx) => {
                        const isSelected = selectedIds.includes(encounter.id);
                        return (
                          <button
                            key={encounter.id}
                            onClick={(e) => handleClick(encounter.id, e)}
                            className={cn(
                              "w-full flex items-center gap-2 px-2 py-1 rounded text-xs text-left",
                              isSelected
                                ? "bg-primary text-primary-foreground"
                                : "hover:bg-muted opacity-60"
                            )}
                          >
                            {encounter.kill ? (
                              <CheckCircle className="h-3 w-3 text-green-500" />
                            ) : (
                              <Skull className="h-3 w-3 text-red-500" />
                            )}
                            <span>#{idx + 1}</span>
                          </button>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

// Compute combined duration from multiple encounters
function computeTotalDuration(encounters: Encounter[]): number {
  return encounters.reduce((total, e) => {
    const start = new Date(e.start_time).getTime();
    const end = new Date(e.end_time).getTime();
    return total + (end - start);
  }, 0);
}

function formatDurationMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

// Format large numbers compactly
function formatDamageNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toFixed(1).toLocaleString();
}

// Panel type definitions
export type PanelType = 'damage_done' | 'damage_taken' | 'enemy_damage_done' | 'enemy_damage_taken';

export interface PanelConfig {
  type: PanelType;
  label: string;
  icon: React.ReactNode;
  chartType: 'damage' | 'healing';
  dataKey: 'dps' | 'healing' | 'damageTaken' | 'enemyDamageDone' | 'enemyDamageTaken';
}

export const PANEL_CONFIGS: Record<PanelType, Omit<PanelConfig, 'type'>> = {
  damage_done: {
    label: 'Damage Done',
    icon: <Swords className="h-4 w-4" />,
    chartType: 'damage',
    dataKey: 'dps',
  },
  damage_taken: {
    label: 'Damage Taken',
    icon: <Shield className="h-4 w-4" />,
    chartType: 'damage',
    dataKey: 'damageTaken',
  },
  enemy_damage_done: {
    label: 'Enemy Damage Done',
    icon: <Skull className="h-4 w-4" />,
    chartType: 'damage',
    dataKey: 'enemyDamageDone',
  },
  enemy_damage_taken: {
    label: 'Enemy Damage Taken',
    icon: <Skull className="h-4 w-4" />,
    chartType: 'damage',
    dataKey: 'enemyDamageTaken',
  },
};

export const PANEL_OPTIONS: { value: PanelType; label: string }[] = Object.entries(PANEL_CONFIGS).map(
  ([value, config]) => ({ value: value as PanelType, label: config.label })
);

interface MetricPanelProps {
  panelType: PanelType;
  onPanelTypeChange: (type: PanelType) => void;
  encounters: Encounter[];
  durationMs: number;
  selectedEnemyIds?: Set<string>;
}

function MetricPanel({ panelType, onPanelTypeChange, encounters, durationMs, selectedEnemyIds }: MetricPanelProps) {
  const [perSecond, setPerSecond] = useState(false);
  const config = PANEL_CONFIGS[panelType];
  let data = mergeMetrics(encounters, config.dataKey);
  
  // For enemy panels, apply filtering based on selected enemies
  const isEnemyPanel = panelType === 'enemy_damage_done' || panelType === 'enemy_damage_taken';
  const hasEnemyFilter = selectedEnemyIds && selectedEnemyIds.size > 0 && isEnemyPanel;
  if (hasEnemyFilter) {
    data = data.map(d => ({
      ...d,
      // Grey out non-selected enemies by reducing their visual prominence
      dimmed: !selectedEnemyIds.has(d.playerID),
    }));
  }

  // Show per-second toggle for damage-related panels
  const showPerSecondToggle = config.chartType === 'damage';

  if (data.length === 0) {
    return null;
  }

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
          {config.icon}
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
      />
    </Card>
  );
}

// Entity selection state - can select both enemies and players
interface EntitySelection {
  enemyIds: Set<string>;
  playerIds: Set<string>;
}

// Main encounter detail view
function EncounterDetail({ encounters }: { encounters: Encounter[] }) {
  const isSingle = encounters.length === 1;
  const encounter = encounters[0];
  
  // Panel state - each panel can be configured independently
  const [panel1Type, setPanel1Type] = useState<PanelType>('damage_done');
  const [panel2Type, setPanel2Type] = useState<PanelType>('damage_taken');
  
  // Entity selection - both enemies and players can be selected
  const [entitySelection, setEntitySelection] = useState<EntitySelection>({
    enemyIds: new Set(),
    playerIds: new Set(),
  });
  
  // Active tab
  const [activeTab, setActiveTab] = useState<'enemies' | 'players'>('enemies');
  
  // Toggle enemy selection
  const toggleEnemySelection = (enemyId: string) => {
    setEntitySelection(prev => {
      const next = new Set(prev.enemyIds);
      if (next.has(enemyId)) {
        next.delete(enemyId);
      } else {
        next.add(enemyId);
      }
      return { ...prev, enemyIds: next };
    });
  };
  
  // Toggle player selection
  const togglePlayerSelection = (playerId: string) => {
    setEntitySelection(prev => {
      const next = new Set(prev.playerIds);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      return { ...prev, playerIds: next };
    });
  };
  
  // Clear all selections
  const clearEntitySelection = () => {
    setEntitySelection({ enemyIds: new Set(), playerIds: new Set() });
  };
  
  // Merge metrics across all selected encounters
  const mergedEnemies = mergeEnemies(encounters);
  const mergedPlayers = mergePlayers(encounters);
  
  const totalDurationMs = computeTotalDuration(encounters);
  
  // Helper to check if an enemy is selected
  const isEnemySelected = (id: string) => entitySelection.enemyIds.has(id);
  
  // Helper to check if a player is selected
  const isPlayerSelected = (id: string) => entitySelection.playerIds.has(id);
  
  // Get selected enemy IDs for MetricPanel (for backward compatibility)
  const selectedEnemyIds = entitySelection.enemyIds;
  
  // Has any selection
  const hasSelection = entitySelection.enemyIds.size > 0 || entitySelection.playerIds.size > 0;
  
  // Selection counts for display
  const selectedEnemyCount = entitySelection.enemyIds.size;
  const selectedPlayerCount = entitySelection.playerIds.size;
  const totalSelectionCount = selectedEnemyCount + selectedPlayerCount;

  // Build title
  const title = isSingle
    ? encounter.name
    : `${encounters.length} Encounters Selected`;

  const subtitle = isSingle
    ? (!encounter.kill ? "(Wipe)" : null)
    : encounters.map(e => e.name).filter((v, i, a) => a.indexOf(v) === i).join(", ");

  return (
    <div className="flex-1 min-w-0">
      {/* Encounter header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {isSingle && (
            encounter.kill ? (
              <CheckCircle className="h-6 w-6 text-green-500" />
            ) : (
              <Skull className="h-6 w-6 text-red-500" />
            )
          )}
          <div>
            <h2 className="text-xl font-semibold">{title}</h2>
            {subtitle && (
              <p className="text-sm text-muted-foreground truncate max-w-md">{subtitle}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>{formatDurationMs(totalDurationMs)}</span>
        </div>
      </div>

      {/* Entity selection - Enemies and Players tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'enemies' | 'players')} className="mb-6">
        <Collapsible>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TabsList>
                  <TabsTrigger value="enemies" className="gap-1.5">
                    <Skull className="h-4 w-4" />
                    Enemies ({mergedEnemies.length})
                    {selectedEnemyCount > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary/20 text-primary rounded-full">
                        {selectedEnemyCount}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="players" className="gap-1.5">
                    <Users className="h-4 w-4" />
                    Players ({mergedPlayers.length})
                    {selectedPlayerCount > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary/20 text-primary rounded-full">
                        {selectedPlayerCount}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>
                {hasSelection && (
                  <button
                    onClick={clearEntitySelection}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    Clear ({totalSelectionCount})
                  </button>
                )}
              </div>
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-2 px-3 py-2 -mr-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <span className="text-xs">
                    {activeTab === 'enemies' ? mergedEnemies.length : mergedPlayers.length} units
                  </span>
                  <ChevronRight className="h-4 w-4 transition-transform duration-200 [[data-state=open]_&]:rotate-90" />
                </button>
              </CollapsibleTrigger>
            </div>

            <CollapsibleContent>
              <div className="mt-3">
                <TabsContent value="enemies" className="mt-0">
                  <div className="flex flex-wrap gap-2">
                    {mergedEnemies.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No enemies in this encounter</p>
                    ) : (
                      mergedEnemies.map((enemy) => {
                        const isSelected = isEnemySelected(enemy.id);
                        return (
                          <Tooltip key={enemy.id}>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => toggleEnemySelection(enemy.id)}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm cursor-pointer transition-all",
                                  enemy.killed
                                    ? "bg-green-500/15 border border-green-500/30"
                                    : "bg-red-500/15 border border-red-500/30",
                                  isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                                  hasSelection && !isSelected && "opacity-50"
                                )}
                              >
                                <span className={cn(
                                  "w-2 h-2 rounded-full flex-shrink-0",
                                  enemy.killed ? "bg-green-500" : "bg-red-500"
                                )} />
                                <span className="font-medium">{enemy.name}</span>
                                <span className="text-muted-foreground text-xs">
                                  {formatDamageNumber(enemy.damageTaken)} dmg taken
                                </span>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="p-3">
                              {formatPeriodsTooltip(enemy.id, enemy.periods)}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="players" className="mt-0">
                  <div className="flex flex-wrap gap-2">
                    {mergedPlayers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No players in this encounter</p>
                    ) : (
                      mergedPlayers.map((player) => {
                        const isSelected = isPlayerSelected(player.id);
                        return (
                          <button
                            key={player.id}
                            onClick={() => togglePlayerSelection(player.id)}
                            className={cn(
                              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm cursor-pointer transition-all",
                              "bg-muted/50 border border-border hover:bg-muted",
                              isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                              hasSelection && !isSelected && "opacity-50"
                            )}
                          >
                            <span 
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: `var(--class-${player.className.toLowerCase()})` }}
                            />
                            <span className="font-medium">{player.name}</span>
                            <span className="text-muted-foreground text-xs">
                              {formatDamageNumber(player.damageDone)} dmg
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </TabsContent>
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </Tabs>

      {/* Metrics - 2 column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MetricPanel
          panelType={panel1Type}
          onPanelTypeChange={setPanel1Type}
          encounters={encounters}
          durationMs={totalDurationMs}
          selectedEnemyIds={selectedEnemyIds}
        />
        <MetricPanel
          panelType={panel2Type}
          onPanelTypeChange={setPanel2Type}
          encounters={encounters}
          durationMs={totalDurationMs}
          selectedEnemyIds={selectedEnemyIds}
        />
      </div>
    </div>
  );
}

export function InstancePageView({
  instance,
  selectedEncounterIds,
  onSelectEncounters,
  onBack,
}: InstancePageViewProps) {
  // Find first boss kill, or first encounter if no boss kills
  const firstBossKill = instance.encounters.find((e) => e.boss && e.kill);
  const defaultEncounter = firstBossKill || instance.encounters[0];
  
  const [internalSelectedIds, setInternalSelectedIds] = useState<string[]>(
    selectedEncounterIds || (defaultEncounter ? [defaultEncounter.id] : [])
  );
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const selectedIds = selectedEncounterIds ?? internalSelectedIds;
  
  const handleSelect = (id: string, mode: 'single' | 'toggle') => {
    const update = onSelectEncounters ?? setInternalSelectedIds;
    
    if (mode === 'toggle') {
      // Toggle selection
      if (selectedIds.includes(id)) {
        // Don't allow deselecting the last one
        if (selectedIds.length > 1) {
          update(selectedIds.filter(sid => sid !== id));
        }
      } else {
        update([...selectedIds, id]);
      }
    } else {
      // Single select replaces
      update([id]);
    }
  };

  const selectedEncounters = instance.encounters.filter((e) => selectedIds.includes(e.id));
  const trashGroups = groupTrashEncounters(instance.encounters);

  const totalDuration = instance.endTime
    ? formatDuration(instance.startTime, instance.endTime)
    : null;

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{instance.name}</h1>
            <p className="text-muted-foreground text-sm">
              {instance.realm && `${instance.realm} • `}
              {formatTime(instance.startTime)}
              {totalDuration && ` • ${totalDuration}`}
            </p>
          </div>
        </div>
      </div>

      {/* Main content: sidebar + detail */}
      <div className="flex gap-6">
        {sidebarOpen ? (
          <EncounterSidebar
            onCollapse={() => setSidebarOpen(false)}
            encounters={instance.encounters}
            trashGroups={trashGroups}
            selectedIds={selectedIds}
            onSelect={handleSelect}
          />
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(true)}
            className="shrink-0"
            title="Show sidebar"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        )}

        {selectedEncounters.length > 0 ? (
          <EncounterDetail encounters={selectedEncounters} />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground">Select an encounter to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Map WoW API class names (uppercase) to display names (title case)
const classDisplayNames: Record<WoWHeroClasses, string> = {
  DRUID: "Druid",
  HUNTER: "Hunter",
  MAGE: "Mage",
  PALADIN: "Paladin",
  PRIEST: "Priest",
  ROGUE: "Rogue",
  SHAMAN: "Shaman",
  WARLOCK: "Warlock",
  WARRIOR: "Warrior",
  UNKNOWN: "Unknown",
};

// Helper to get player name from lookup, with fallback
function getPlayerName(guidStr: string, players: Record<string, InstancePlayer>): string {
  const player = players[guidStr];
  if (player) {
    return player.name;
  }
  // Fallback: try to show a short version of the GUID
  return `Player ${guidStr.slice(-6)}`;
}

// Helper to get player class display name from lookup
function getPlayerClass(guidStr: string, players: Record<string, InstancePlayer>): string {
  const player = players[guidStr];
  if (player) {
    return classDisplayNames[player.class] || player.class;
  }
  return "Unknown";
}

// Helper to get unit name from lookup, with fallback
function getUnitName(guidStr: string, units: Record<string, InstanceUnit>): string {
  const unit = units[guidStr];
  if (unit) {
    return unit.name;
  }
  // Fallback: try to show a short version of the GUID
  return `Enemy ${guidStr}`;
}

// Convert API ability record to AbilityBreakdown array
function convertAbilitiesToBreakdown(abilities: Record<string, Ability>): AbilityBreakdown[] {
  return Object.entries(abilities).map(([name, ability]) => ({
    name,
    totalDamage: ability.total_damage,
    hitCount: ability.hit_count,
    critCount: ability.crit_count,
    missCount: ability.miss_count,
    dodgeCount: ability.dodge_count,
    immuneCount: ability.immune_count,
    parryCount: ability.parry_count,
    otherCount: ability.other_count,
  }));
}

// Helper to transform API data to view data
function transformToInstance(
  apiInstance: {
    id: string;
    name: string;
    encounters: readonly WoWEncounterWithHostiles[];
    players: Record<string, InstancePlayer>;
    units: Record<string, InstanceUnit>;
  },
  damageSummary: EncounterDamageSummary[]
): Instance {
  const { players, units } = apiInstance;

  // Group damage summaries by encounter
  const damageByEncounter = new Map<string, EncounterDamageSummary[]>();
  for (const summary of damageSummary) {
    const existing = damageByEncounter.get(summary.encounter_id) || [];
    existing.push(summary);
    damageByEncounter.set(summary.encounter_id, existing);
  }

  // Map encounters with damage data
  const encounters: Encounter[] = apiInstance.encounters.map((enc) => {
    const encounterDamage = damageByEncounter.get(enc.id) || [];
    
    // Filter player damage entries
    const playerDamage = encounterDamage.filter((d) => d.is_player);
    
    // Build a lookup for damage data by GUID
    const damageByGuid = new Map<string, EncounterDamageSummary>();
    for (const d of encounterDamage) {
      damageByGuid.set(String(d.unit_guid), d);
    }
    
    const dps: PlayerMetricChartData[] = playerDamage.map((d) => {
      const guidStr = String(d.unit_guid);
      return {
        playerID: guidStr,
        playerName: getPlayerName(guidStr, players),
        className: getPlayerClass(guidStr, players),
        specialization: "",
        value: d.damage_done_total,
        abilityBreakdown: convertAbilitiesToBreakdown(d.damage_done_abilities),
      };
    });

    const damageTaken: PlayerMetricChartData[] = playerDamage.map((d) => {
      const guidStr = String(d.unit_guid);
      return {
        playerID: guidStr,
        playerName: getPlayerName(guidStr, players),
        className: getPlayerClass(guidStr, players),
        specialization: "",
        value: d.damage_taken_total,
        abilityBreakdown: convertAbilitiesToBreakdown(d.damage_taken_abilities),
      };
    });

    // Build enemies from encounter hostiles (instead of inferring from damage data)
    const enemies: EnemyUnit[] = enc.hostiles
      .map((hostile) => {
        const guidStr = String(hostile.id);
        const damage = damageByGuid.get(guidStr);
        return {
          id: guidStr,
          name: getUnitName(guidStr, units),
          damageTaken: damage?.damage_taken_total ?? 0, // damage they took from players
          damageDone: damage?.damage_done_total ?? 0,   // damage they dealt to players
          periods: hostile.periods,
        };
      })
      .sort((a, b) => b.damageTaken - a.damageTaken); // sort by damage taken (most damaged first)

    // Build enemy damage done metrics (damage dealt by enemies to players)
    const enemyDamageDone: PlayerMetricChartData[] = enemies
      .filter((e) => e.damageDone > 0)
      .map((enemy) => {
        const damage = damageByGuid.get(enemy.id);
        return {
          playerID: enemy.id,
          playerName: enemy.name,
          className: "Enemy", // use "Enemy" as the class for styling
          specialization: "",
          value: enemy.damageDone,
          abilityBreakdown: damage ? convertAbilitiesToBreakdown(damage.damage_done_abilities) : [],
        };
      })
      .sort((a, b) => b.value - a.value);

    // Build enemy damage taken metrics (damage taken by enemies from players)
    const enemyDamageTaken: PlayerMetricChartData[] = enemies
      .filter((e) => e.damageTaken > 0)
      .map((enemy) => {
        const damage = damageByGuid.get(enemy.id);
        return {
          playerID: enemy.id,
          playerName: enemy.name,
          className: "Enemy", // use "Enemy" as the class for styling
          specialization: "",
          value: enemy.damageTaken,
          abilityBreakdown: damage ? convertAbilitiesToBreakdown(damage.damage_taken_abilities) : [],
        };
      })
      .sort((a, b) => b.value - a.value);

    return {
      id: enc.id,
      name: enc.name,
      boss: enc.boss,
      kill: enc.kill,
      start_time: enc.start_time,
      end_time: enc.end_time,
      dps: dps.filter((d) => d.value > 0),
      damageTaken: damageTaken.filter((d) => d.value > 0),
      enemyDamageDone,
      enemyDamageTaken,
      enemies,
      remaining: enc.remaining as string[] | undefined,
      // healing: [] // TODO: add healing data when available
    };
  });

  // Compute instance timing from encounters
  const sortedEncounters = [...apiInstance.encounters].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );
  const startTime = sortedEncounters[0]?.start_time || new Date().toISOString();
  const endTime = sortedEncounters[sortedEncounters.length - 1]?.end_time;

  return {
    id: apiInstance.id,
    name: apiInstance.name,
    startTime,
    endTime,
    encounters,
    players,
    units,
  };
}

// Connected component that fetches data
export function InstancePage() {
  const { instanceId } = useParams<{ instanceId: string }>();
  const navigate = useNavigate();

  const { data: apiInstance, isLoading: instanceLoading, error: instanceError } = useInstance(
    instanceId || "",
    { enabled: !!instanceId }
  );

  const { data: damageSummary, isLoading: damageLoading } = useInstanceDamageSummary(
    instanceId || "",
    { enabled: !!instanceId }
  );

  const instance = useMemo(() => {
    if (!apiInstance) return null;
    return transformToInstance(apiInstance, damageSummary || []);
  }, [apiInstance, damageSummary]);

  const isLoading = instanceLoading || damageLoading;

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading instance data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (instanceError || !instance) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <Link
          to="/logs"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Logs
        </Link>
        <Card className="p-6">
          <p className="text-destructive">
            {instanceError?.message || "Failed to load instance"}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <InstancePageView
      instance={instance}
      onBack={() => navigate(-1)}
    />
  );
}
