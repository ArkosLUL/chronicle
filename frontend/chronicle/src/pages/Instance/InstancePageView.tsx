import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, Skull, CheckCircle, ChevronDown, ChevronRight, Clock, PanelLeftClose, PanelLeft, Users } from "lucide-react";
import { useUrlState, serializers } from "@/hooks/useUrlState";
import type { ActivityPeriod, InstancePlayer } from "@/api/typesGenerated";
import { Card } from "@/components/ui/Card/Card";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/Collapsible/Collapsible";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/Tooltip/tooltip";
import { cn } from "@/lib/utils";
import type { Instance, Encounter, EnemyUnit } from "./InstancePage";
import { MetricPanel } from "./Panel";
import { EventsPanel, type EventsPanelType, type PanelContext, type EntitySelection } from "./EventsPanels";
import type { PanelType } from "./panelConfig";

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
// EncounterSidebar component
// ============================================================================

function EncounterSidebar({
  encounters,
  trashGroups,
  selectedIds,
  onSelect,
  onSelectMany,
  onCollapse,
}: {
  encounters: Encounter[];
  trashGroups: TrashGroup[];
  selectedIds: string[];
  onSelect: (id: string, mode: 'single' | 'toggle') => void;
  onSelectMany: (ids: string[]) => void;
  onCollapse: () => void;
}) {
  const bossEncounters = encounters.filter((e) => e.boss);
  const trashEncounterIds = trashGroups.flatMap(g => g.encounters.map(e => e.id));
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
          <div className="flex gap-1 mt-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-5 px-1.5 text-xs"
              onClick={() => onSelectMany(encounters.map(e => e.id))}
              title="Select all encounters"
            >
              All
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-5 px-1.5 text-xs"
              onClick={() => onSelectMany(bossEncounters.map(e => e.id))}
              disabled={bossEncounters.length === 0}
              title="Select boss encounters only"
            >
              Bosses
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-5 px-1.5 text-xs"
              onClick={() => onSelectMany(trashEncounterIds)}
              disabled={trashEncounterIds.length === 0}
              title="Select trash encounters only"
            >
              Trash
            </Button>
          </div>
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
// EncounterDetail component
// ============================================================================

interface EncounterDetailProps {
  instance: Instance;
  encounters: Encounter[];
  players: Record<string, InstancePlayer>;
  entitySelection: EntitySelection;
  onToggleEnemy: (enemyId: string) => void;
  onTogglePlayer: (playerId: string) => void;
  onClearSelection: () => void;
}

// Serializer for EventsPanelType - validates against known panel types
const eventsPanelSerializer = {
  serialize: (v: EventsPanelType) => v,
  deserialize: (v: string | null, d: EventsPanelType): EventsPanelType => {
    const validTypes: EventsPanelType[] = [
      'damage_done', 'enemy_damage_done', 'pet_damage_done', 
      'damage_taken', 'enemy_damage_taken', 'healing_done', 'all_activity'
    ];
    return v && validTypes.includes(v as EventsPanelType) ? v as EventsPanelType : d;
  },
};

function EncounterDetail({ 
  instance,
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
  
  // Events panel state (new event-driven panels) - URL persisted
  const [eventsPanel1Type, setEventsPanel1Type] = useUrlState<EventsPanelType>(
    'panel1', 'damage_done', eventsPanelSerializer
  );
  const [eventsPanel2Type, setEventsPanel2Type] = useUrlState<EventsPanelType>(
    'panel2', 'all_activity', eventsPanelSerializer
  );
  
  // Active tab and collapsible state
  const [activeTab, setActiveTab] = useState<'enemies' | 'players'>('enemies');
  const [isEntityPanelOpen, setIsEntityPanelOpen] = useState(false);
  
  // Merge enemies across all selected encounters
  const mergedEnemies = mergeEnemies(encounters);
  const mappedEnemies = new Map(mergedEnemies.map(e => [e.id, e.name]));
  
  const totalDurationMs = computeTotalDuration(encounters);
  
  // Build PanelContext for EventsPanels
  const panelContext: PanelContext = {
    instance,
    selectedEncounters: encounters,
    selectedEncounterIds: encounters.map(e => e.id),
    entitySelection,
  };
  
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
      {/* Events Panels - New event-driven panels (experimental) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <EventsPanel
          panelType={eventsPanel1Type}
          onPanelTypeChange={setEventsPanel1Type}
          durationMs={totalDurationMs}
          context={panelContext}
        />
        <EventsPanel
          panelType={eventsPanel2Type}
          onPanelTypeChange={setEventsPanel2Type}
          durationMs={totalDurationMs}
          context={panelContext}
        />
      </div>

      {/* Metrics - 2 column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MetricPanel
          instanceId={instance.id}
          panelType={panel1Type}
          onPanelTypeChange={setPanel1Type}
          durationMs={totalDurationMs}
          players={players}
          enemies={mappedEnemies}
          selectedPlayerIds={entitySelection.playerIds}
          selectedEnemyIds={entitySelection.enemyIds}
          selectedEncounters={encounters}
        />
        <MetricPanel
          instanceId={instance.id}
          panelType={panel2Type}
          onPanelTypeChange={setPanel2Type}
          durationMs={totalDurationMs}
          players={players}
          enemies={mappedEnemies}
          selectedPlayerIds={entitySelection.playerIds}
          selectedEnemyIds={entitySelection.enemyIds}
          selectedEncounters={encounters}
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
  const defaultEncounterId = defaultEncounter?.id ?? "";
  
  // URL-persisted state for encounter selection
  const [urlEncounterIds, setUrlEncounterIds] = useUrlState(
    "encounters",
    [] as string[],
    serializers.stringArray
  );
  
  // Use URL state if present, otherwise use prop or default
  const internalSelectedIds = useMemo(() => {
    if (urlEncounterIds.length > 0) {
      // Filter to only valid encounter IDs
      const validIds = urlEncounterIds.filter(id => 
        instance.encounters.some(e => e.id === id)
      );
      if (validIds.length > 0) return validIds;
    }
    return selectedEncounterIds || (defaultEncounterId ? [defaultEncounterId] : []);
  }, [urlEncounterIds, selectedEncounterIds, defaultEncounterId, instance.encounters]);
  
  const setInternalSelectedIds = (ids: string[]) => {
    setUrlEncounterIds(ids);
    onSelectEncounters?.(ids);
  };
  
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // URL-persisted entity selection state
  const [, setSearchParams] = useSearchParams();
  const [urlEnemyIds, setUrlEnemyIds] = useUrlState("enemies", new Set<string>(), serializers.stringSet);
  const [urlPlayerIds, setUrlPlayerIds] = useUrlState("players", new Set<string>(), serializers.stringSet);
  
  const entitySelection = useMemo<EntitySelection>(() => ({
    enemyIds: urlEnemyIds,
    playerIds: urlPlayerIds,
  }), [urlEnemyIds, urlPlayerIds]);
  
  // Toggle enemy selection
  const toggleEnemySelection = (enemyId: string) => {
    setUrlEnemyIds(prev => {
      const next = new Set(prev);
      if (next.has(enemyId)) {
        next.delete(enemyId);
      } else {
        next.add(enemyId);
      }
      return next;
    });
  };
  
  // Toggle player selection
  const togglePlayerSelection = (playerId: string) => {
    setUrlPlayerIds(prev => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      return next;
    });
  };
  
  // Clear all entity selections - use setSearchParams directly to clear both in one update
  // (avoids race condition where two separate useUrlState updates can override each other)
  const clearEntitySelection = () => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete("enemies");
      next.delete("players");
      return next;
    }, { replace: true });
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
            onSelectMany={(ids) => {
              const update = onSelectEncounters ?? setInternalSelectedIds;
              update(ids);
            }}
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
            instance={instance}
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
