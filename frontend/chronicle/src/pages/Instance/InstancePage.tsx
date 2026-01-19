import { useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Skull, CheckCircle, ChevronDown, ChevronRight, Clock, Swords, Heart, Shield, PanelLeftClose, PanelLeft, Loader2 } from "lucide-react";
import { useInstance, useInstanceDamageSummary, type EncounterDamageSummary, type WoWEncounter } from "@/api/queries";
import type { InstancePlayer, InstanceUnit, WoWHeroClasses } from "@/api/typesGenerated";
import { Card } from "@/components/ui/Card/Card";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/Collapsible/Collapsible";
import { PlayerMetricChart, type PlayerMetricChartData } from "@/components/ui/PlayerMetricChart/PlayerMetricChart";
import { cn } from "@/lib/utils";

// Types for the Instance page
export interface EnemyUnit {
  id: string;
  name: string;
  damageTaken: number; // damage taken from players
  damageDone: number;  // damage done to players
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
  enemies?: EnemyUnit[];
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

// Merge metrics from multiple encounters by summing values per player
function mergeMetrics(encounters: Encounter[], key: 'dps' | 'healing' | 'damageTaken'): PlayerMetricChartData[] {
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
      } else {
        playerMap.set(metric.playerID, { ...metric });
      }
    }
  }

  return Array.from(playerMap.values());
}

// Merge enemies from multiple encounters by summing damage values
function mergeEnemies(encounters: Encounter[]): EnemyUnit[] {
  const enemyMap = new Map<string, EnemyUnit>();

  for (const encounter of encounters) {
    const enemies = encounter.enemies;
    if (!enemies) continue;

    for (const enemy of enemies) {
      const existing = enemyMap.get(enemy.id);
      if (existing) {
        existing.damageTaken += enemy.damageTaken;
        existing.damageDone += enemy.damageDone;
      } else {
        enemyMap.set(enemy.id, { ...enemy });
      }
    }
  }

  return Array.from(enemyMap.values()).sort((a, b) => b.damageTaken - a.damageTaken);
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
  return value.toLocaleString();
}

// Main encounter detail view
function EncounterDetail({ encounters }: { encounters: Encounter[] }) {
  const isSingle = encounters.length === 1;
  const encounter = encounters[0];
  
  // Merge metrics across all selected encounters
  const mergedDps = mergeMetrics(encounters, 'dps');
  const mergedHealing = mergeMetrics(encounters, 'healing');
  const mergedDamageTaken = mergeMetrics(encounters, 'damageTaken');
  const mergedEnemies = mergeEnemies(encounters);
  
  const totalDurationMs = computeTotalDuration(encounters);

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

      {/* Enemies fought */}
      {mergedEnemies.length > 0 && (
        <Collapsible className="mb-6">
          <Card className="p-4">
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between text-left">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Skull className="h-4 w-4" />
                  Enemies ({mergedEnemies.length})
                </h3>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]_&]:rotate-90" />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="flex flex-wrap gap-2 mt-3">
                {mergedEnemies.map((enemy) => (
                  <div
                    key={enemy.id}
                    className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-md text-sm"
                  >
                    <span className="font-medium">{enemy.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {formatDamageNumber(enemy.damageTaken)} dmg taken
                    </span>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Metrics - 2 column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {mergedDps.length > 0 && (
          <Card className="p-4">
            <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
              <Swords className="h-4 w-4" />
              Damage Done
            </h3>
            <PlayerMetricChart data={mergedDps} type="damage" duration_millis={totalDurationMs} style={{ height: "400px" }} />
          </Card>
        )}

        {mergedHealing.length > 0 && (
          <Card className="p-4">
            <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
              <Heart className="h-4 w-4" />
              Healing
            </h3>
            <PlayerMetricChart data={mergedHealing} type="healing" duration_millis={totalDurationMs} style={{ height: "400px" }} />
          </Card>
        )}

        {mergedDamageTaken.length > 0 && (
          <Card className="p-4">
            <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Damage Taken
            </h3>
            <PlayerMetricChart data={mergedDamageTaken} type="damage" duration_millis={totalDurationMs} style={{ height: "400px" }} />
          </Card>
        )}

        {mergedDps.length === 0 && mergedHealing.length === 0 && mergedDamageTaken.length === 0 && (
          <Card className="p-8 col-span-full">
            <p className="text-muted-foreground text-center">
              No detailed metrics available for the selected encounter(s).
            </p>
          </Card>
        )}
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
  return `Enemy ${guidStr.slice(-6)}`;
}

// Helper to transform API data to view data
function transformToInstance(
  apiInstance: {
    id: string;
    name: string;
    encounters: readonly WoWEncounter[];
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
    
    // Separate players from enemies using the GUID helper
    const playerDamage = encounterDamage.filter((d) => d.is_player);
    const enemyDamage = encounterDamage.filter((d) => !d.is_player && !d.owner_guid);
    
    const dps: PlayerMetricChartData[] = playerDamage.map((d) => {
      const guidStr = String(d.unit_guid);
      return {
        playerID: guidStr,
        playerName: getPlayerName(guidStr, players),
        className: getPlayerClass(guidStr, players),
        specialization: "",
        value: d.damage_done_total,
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
      };
    });

    // Extract enemy units (non-players without owners, i.e. not pets)
    const enemies: EnemyUnit[] = enemyDamage
      .map((d) => {
        const guidStr = String(d.unit_guid);
        return {
          id: guidStr,
          name: getUnitName(guidStr, units),
          damageTaken: d.damage_taken_total, // damage they took from players
          damageDone: d.damage_done_total,   // damage they dealt to players
        };
      })
      .filter((e) => e.damageTaken > 0 || e.damageDone > 0)
      .sort((a, b) => b.damageTaken - a.damageTaken); // sort by damage taken (most damaged first)

    return {
      id: enc.id,
      name: enc.name,
      boss: enc.boss,
      kill: enc.kill,
      start_time: enc.start_time,
      end_time: enc.end_time,
      dps: dps.filter((d) => d.value > 0),
      damageTaken: damageTaken.filter((d) => d.value > 0),
      enemies,
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
