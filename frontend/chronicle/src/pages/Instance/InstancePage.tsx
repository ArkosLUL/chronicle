import { useState } from "react";
import { ArrowLeft, Skull, CheckCircle, ChevronDown, ChevronRight, Clock, Swords, Heart, Shield, PanelLeftClose, PanelLeft } from "lucide-react";
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
}

export interface Instance {
  id: string;
  name: string;
  realm?: string;
  startTime: string;
  endTime?: string;
  encounters: Encounter[];
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
  onSelect: (id: string, multiSelect: boolean) => void;
  onCollapse: () => void;
}) {
  const [trashOpen, setTrashOpen] = useState(false);
  const [expandedTrashGroup, setExpandedTrashGroup] = useState<string | null>(null);

  const bossEncounters = encounters.filter((e) => e.boss);
  const totalTrash = trashGroups.reduce((sum, g) => sum + g.encounters.length, 0);

  const handleClick = (id: string, e: React.MouseEvent) => {
    onSelect(id, e.metaKey || e.ctrlKey);
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
            {modifierKey}+click to select multiple
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
        <Collapsible open={trashOpen} onOpenChange={setTrashOpen} className="mt-4">
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left hover:bg-muted opacity-60">
              {trashOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <span>Trash</span>
              <span className="text-muted-foreground">({totalTrash})</span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="ml-2 mt-1 space-y-1">
              {trashGroups.map((group) => (
                <Collapsible
                  key={group.name}
                  open={expandedTrashGroup === group.name}
                  onOpenChange={(open) => setExpandedTrashGroup(open ? group.name : null)}
                >
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center gap-2 px-3 py-1.5 rounded text-xs text-left hover:bg-muted opacity-70">
                      {expandedTrashGroup === group.name ? (
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
              ))}
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

// Main encounter detail view
function EncounterDetail({ encounters }: { encounters: Encounter[] }) {
  const isSingle = encounters.length === 1;
  const encounter = encounters[0];
  
  // Merge metrics across all selected encounters
  const mergedDps = mergeMetrics(encounters, 'dps');
  const mergedHealing = mergeMetrics(encounters, 'healing');
  const mergedDamageTaken = mergeMetrics(encounters, 'damageTaken');
  
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

      {/* Metrics - 2 column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {mergedDps.length > 0 && (
          <Card className="p-4">
            <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
              <Swords className="h-4 w-4" />
              Damage Done
            </h3>
            <PlayerMetricChart data={mergedDps} type="damage" style={{ height: "400px" }} />
          </Card>
        )}

        {mergedHealing.length > 0 && (
          <Card className="p-4">
            <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
              <Heart className="h-4 w-4" />
              Healing
            </h3>
            <PlayerMetricChart data={mergedHealing} type="healing" style={{ height: "400px" }} />
          </Card>
        )}

        {mergedDamageTaken.length > 0 && (
          <Card className="p-4">
            <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Damage Taken
            </h3>
            <PlayerMetricChart data={mergedDamageTaken} type="damage" style={{ height: "400px" }} />
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
  
  const handleSelect = (id: string, multiSelect: boolean) => {
    const update = onSelectEncounters ?? setInternalSelectedIds;
    
    if (multiSelect) {
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
