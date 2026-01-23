import { useState } from "react";
import { ArrowLeft, Skull, CheckCircle, ChevronDown, ChevronRight, Clock, Swords, Shield, PanelLeftClose, PanelLeft, Users } from "lucide-react";
import type { ActivityPeriod, InstancePlayer, WoWHeroClasses } from "@/api/typesGenerated";
import { Card } from "@/components/ui/Card/Card";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/Collapsible/Collapsible";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PlayerMetricChart, type PlayerMetricChartData } from "@/components/ui/PlayerMetricChart/PlayerMetricChart";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/Tooltip/tooltip";
import { cn } from "@/lib/utils";
import type { Instance, Encounter, EnemyUnit } from "./InstancePage";

// ============================================================================
// Formatting helpers
// ============================================================================

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

function formatPeriodMoment(moment: { timestamp: string; reason: string } | undefined): string {
  if (!moment) return "N/A";
  const time = new Date(moment.timestamp).toLocaleTimeString();
  return `${time} (${moment.reason})`;
}

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

function formatDamageNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toFixed(1).toLocaleString();
}

// ============================================================================
// Trash grouping
// ============================================================================

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

// ============================================================================
// Enemy merging
// ============================================================================

interface MergedEnemy extends Omit<EnemyUnit, 'periods'> {
  killed: boolean;
  periods: ActivityPeriod[];
}

function mergeEnemies(encounters: Encounter[]): MergedEnemy[] {
  const enemyMap = new Map<string, MergedEnemy>();
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
        existing.periods = [...existing.periods, ...enemy.periods];
      } else {
        enemyMap.set(enemy.id, {
          ...enemy,
          periods: [...enemy.periods],
          killed: !remainingSet.has(enemy.id),
        });
      }
    }
  }

  return Array.from(enemyMap.values()).sort((a, b) => b.damageTaken - a.damageTaken);
}

// ============================================================================
// Panel configuration
// ============================================================================

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

// ============================================================================
// Player filter component
// ============================================================================

// Class display order (matches typical raid UI)
const CLASS_ORDER: WoWHeroClasses[] = [
  "WARRIOR", "PALADIN", "HUNTER", "ROGUE", "PRIEST", 
  "SHAMAN", "MAGE", "WARLOCK", "DRUID"
];

// Format class name for display
function formatClassName(cls: WoWHeroClasses): string {
  return cls.charAt(0) + cls.slice(1).toLowerCase();
}

interface PlayerFilterProps {
  players: Record<string, InstancePlayer>;
  selectedPlayerIds: Set<string>;
  onTogglePlayer: (playerId: string) => void;
  onClearSelection: () => void;
  onSelectAll: () => void;
}

function PlayerFilter({
  players,
  selectedPlayerIds,
  onTogglePlayer,
  onClearSelection,
  onSelectAll,
}: PlayerFilterProps) {
  const playerList = Object.entries(players);
  
  if (playerList.length === 0) {
    return null;
  }
  
  // Group players by class
  const playersByClass = new Map<WoWHeroClasses, Array<{ guid: string; player: InstancePlayer }>>();
  for (const [guid, player] of playerList) {
    const cls = player.class || "UNKNOWN";
    const existing = playersByClass.get(cls) || [];
    existing.push({ guid, player });
    playersByClass.set(cls, existing);
  }
  
  // Sort players within each class alphabetically
  for (const players of playersByClass.values()) {
    players.sort((a, b) => a.player.name.localeCompare(b.player.name));
  }
  
  const hasSelection = selectedPlayerIds.size > 0;
  const allSelected = selectedPlayerIds.size === playerList.length;
  
  return (
    <Card className="p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Users className="h-4 w-4" />
          <span>Players</span>
          {hasSelection && (
            <span className="text-xs text-muted-foreground">
              ({selectedPlayerIds.size} of {playerList.length})
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {hasSelection ? (
            <Button variant="ghost" size="sm" onClick={onClearSelection} className="h-6 px-2 text-xs">
              Clear
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={onSelectAll} className="h-6 px-2 text-xs">
              Select All
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {CLASS_ORDER.filter(cls => playersByClass.has(cls)).map(cls => {
          const classPlayers = playersByClass.get(cls)!;
          return classPlayers.map(({ guid, player }) => {
            const isSelected = selectedPlayerIds.has(guid);
            return (
              <button
                key={guid}
                onClick={() => onTogglePlayer(guid)}
                className={cn(
                  "px-2 py-0.5 rounded text-xs font-medium transition-all border",
                  isSelected
                    ? "border-current opacity-100"
                    : hasSelection
                      ? "border-transparent opacity-40 hover:opacity-70"
                      : "border-transparent opacity-100 hover:opacity-80"
                )}
                style={{ 
                  color: `var(--class-${player.class.toLowerCase()})`,
                  backgroundColor: isSelected ? `color-mix(in oklch, var(--class-${player.class.toLowerCase()}) 15%, transparent)` : undefined,
                }}
                title={`${player.name} - ${formatClassName(player.class)}`}
              >
                {player.name}
              </button>
            );
          });
        })}
        {/* Handle UNKNOWN class if any */}
        {playersByClass.has("UNKNOWN") && playersByClass.get("UNKNOWN")!.map(({ guid, player }) => {
          const isSelected = selectedPlayerIds.has(guid);
          return (
            <button
              key={guid}
              onClick={() => onTogglePlayer(guid)}
              className={cn(
                "px-2 py-0.5 rounded text-xs font-medium transition-all border",
                isSelected
                  ? "border-current opacity-100"
                  : hasSelection
                    ? "border-transparent opacity-40 hover:opacity-70"
                    : "border-transparent opacity-100 hover:opacity-80"
              )}
              style={{ 
                color: `var(--class-unknown)`,
                backgroundColor: isSelected ? `color-mix(in oklch, var(--class-unknown) 15%, transparent)` : undefined,
              }}
              title={`${player.name} - Unknown`}
            >
              {player.name}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

export const PANEL_OPTIONS: { value: PanelType; label: string }[] = Object.entries(PANEL_CONFIGS).map(
  ([value, config]) => ({ value: value as PanelType, label: config.label })
);

// ============================================================================
// EncounterSidebar component
// ============================================================================

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

  const groupsWithSelectedTrash = trashGroups
    .filter(g => g.encounters.some(e => selectedIds.includes(e.id)))
    .map(g => g.name);
  const hasSelectedTrash = groupsWithSelectedTrash.length > 0;

  const [trashOpen, setTrashOpen] = useState(false);
  const [manualExpandedGroup, setManualExpandedGroup] = useState<string | null>(null);

  const effectiveTrashOpen = trashOpen || hasSelectedTrash;
  
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

// ============================================================================
// MetricPanel component
// ============================================================================

interface MetricPanelProps {
  panelType: PanelType;
  onPanelTypeChange: (type: PanelType) => void;
  encounters: Encounter[];
  durationMs: number;
  selectedEnemyIds?: Set<string>;
}

function MetricPanel({ panelType, onPanelTypeChange, durationMs }: MetricPanelProps) {
  const [perSecond, setPerSecond] = useState(false);
  const config = PANEL_CONFIGS[panelType];
  
  // TODO: Panel should fetch/compute its own data based on panelType
  // For now, return empty data
  const data: PlayerMetricChartData[] = [];

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
        panelTitle={config.label}
      />
    </Card>
  );
}

// ============================================================================
// EncounterDetail component
// ============================================================================

interface EntitySelection {
  enemyIds: Set<string>;
  playerIds: Set<string>;
}

interface EncounterDetailProps {
  encounters: Encounter[];
  players: Record<string, InstancePlayer>;
  entitySelection: EntitySelection;
  onToggleEnemy: (enemyId: string) => void;
  onTogglePlayer: (playerId: string) => void;
  onClearSelection: () => void;
}

function EncounterDetail({ 
  encounters,
  players,
  entitySelection,
  onToggleEnemy,
  onTogglePlayer,
  onClearSelection,
}: EncounterDetailProps) {
  const isSingle = encounters.length === 1;
  const encounter = encounters[0];
  
  // Panel state - each panel can be configured independently
  const [panel1Type, setPanel1Type] = useState<PanelType>('damage_done');
  const [panel2Type, setPanel2Type] = useState<PanelType>('damage_taken');
  
  // Active tab and collapsible state
  const [activeTab, setActiveTab] = useState<'enemies' | 'players'>('enemies');
  const [isEntityPanelOpen, setIsEntityPanelOpen] = useState(false);
  
  // Merge enemies across all selected encounters
  const mergedEnemies = mergeEnemies(encounters);
  
  const totalDurationMs = computeTotalDuration(encounters);
  
  // Helper to check if an enemy is selected
  const isEnemySelected = (id: string) => entitySelection.enemyIds.has(id);
  
  // Helper to check if a player is selected
  const isPlayerSelected = (id: string) => entitySelection.playerIds.has(id);
  
  // Build player list sorted by class and name
  const playerList = Object.entries(players).map(([guid, player]) => ({
    guid,
    ...player,
  })).sort((a, b) => {
    // Sort by class first, then by name
    if (a.class !== b.class) {
      return a.class.localeCompare(b.class);
    }
    return a.name.localeCompare(b.name);
  });
  
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
      <Tabs value={activeTab} onValueChange={(v) => {
        setActiveTab(v as 'enemies' | 'players');
        setIsEntityPanelOpen(true);
      }} className="mb-6">
        <Collapsible open={isEntityPanelOpen} onOpenChange={setIsEntityPanelOpen}>
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
                    Players ({playerList.length})
                    {selectedPlayerCount > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary/20 text-primary rounded-full">
                        {selectedPlayerCount}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>
                {hasSelection && (
                  <button
                    onClick={onClearSelection}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    Clear ({totalSelectionCount})
                  </button>
                )}
              </div>
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-2 px-3 py-2 -mr-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <span className="text-xs">
                    {mergedEnemies.length} enemies
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
                                onClick={() => onToggleEnemy(enemy.id)}
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
                    {playerList.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No players in this instance</p>
                    ) : (
                      playerList.map((player) => {
                        const isSelected = isPlayerSelected(player.guid);
                        return (
                          <button
                            key={player.guid}
                            onClick={() => onTogglePlayer(player.guid)}
                            className={cn(
                              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm cursor-pointer transition-all",
                              "bg-muted/50 border border-border hover:bg-muted",
                              isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                              hasSelection && !isSelected && "opacity-50"
                            )}
                          >
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: `var(--class-${player.class.toLowerCase()})` }}
                            />
                            <span
                              className="font-medium"
                              style={{ color: `var(--class-${player.class.toLowerCase()})` }}
                            >
                              {player.name}
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
          // selectedEnemyIds={selectedEnemyIds}
        />
        <MetricPanel
          panelType={panel2Type}
          onPanelTypeChange={setPanel2Type}
          encounters={encounters}
          durationMs={totalDurationMs}
          // selectedEnemyIds={selectedEnemyIds}
        />
      </div>
    </div>
  );
}

// ============================================================================
// InstancePageView component (main export)
// ============================================================================

export interface InstancePageViewProps {
  instance: Instance;
  selectedEncounterIds?: string[];
  onSelectEncounters?: (encounterIds: string[]) => void;
  onBack?: () => void;
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
  
  // Entity selection state - lifted from EncounterDetail for data filtering
  const [entitySelection, setEntitySelection] = useState<EntitySelection>({
    enemyIds: new Set(),
    playerIds: new Set(),
  });
  
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
  
  // Clear all entity selections
  const clearEntitySelection = () => {
    setEntitySelection({ enemyIds: new Set(), playerIds: new Set() });
  };

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
          <EncounterDetail 
            encounters={selectedEncounters}
            players={instance.players ?? {}}
            entitySelection={entitySelection}
            onToggleEnemy={toggleEnemySelection}
            onTogglePlayer={togglePlayerSelection}
            onClearSelection={clearEntitySelection}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground">Select an encounter to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}
