/**
 * DeathLogContent - Chronological list of player deaths with timestamps
 */

import { useMemo, useCallback } from "react";
import { GenericPanel } from "../GenericPanel";
import { ScrollArea } from "@/components/ui/ScrollArea/ScrollArea";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/Tooltip/tooltip";
import type { PanelRenderProps } from "../types";
import type { DeathsResult, DeathEvent } from "./deaths.processor";
import { useCachedValue } from "@/hooks/useCachedValue";
import { cn } from "@/lib/utils";
import { hitTypeNames, HitTypeCrit } from "@/lib/hittype/hittype";


function formatTimestamp(absoluteMilli: number): string {
  const eventTime = new Date(absoluteMilli);
  return eventTime.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/**
 * Format relative time within encounter (e.g., "+1:23.4")
 */
function formatRelativeTime(offsetMilli: number): string {
  const totalSeconds = offsetMilli / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toFixed(1);
  return `+${minutes}:${seconds.padStart(4, "0")}`;
}

/**
 * Get school name from school enum value
 */
function getSchoolName(school: number): string {
  const schools: Record<number, string> = {
    0: "Unknown",
    1: "None",
    2: "Physical",
    3: "Holy",
    4: "Fire",
    5: "Nature",
    6: "Frost",
    7: "Shadow",
    8: "Arcane",
  };
  return schools[school] || "Unknown";
}

/**
 * Get school color for styling
 */
function getSchoolColor(school: number): string {
  const colors: Record<number, string> = {
    2: "text-amber-200",      // Physical
    3: "text-yellow-300",     // Holy
    4: "text-orange-500",     // Fire
    5: "text-green-400",      // Nature
    6: "text-cyan-400",       // Frost
    7: "text-purple-400",     // Shadow
    8: "text-blue-400",       // Arcane
  };
  return colors[school] || "text-muted-foreground";
}

/**
 * Sort death events by offsetMilli and return chronological list.
 */
function getSortedDeathEvents(selectedEncounterIDs:string[], result: DeathsResult): DeathEvent[] {
  // DeathEvents is already populated for selected encounters
  return [...result.DeathEvents].filter((event) => selectedEncounterIDs.includes(event.encounterID)) // sort((a, b) => a.offsetMilli - b.offsetMilli);
}

type DeathLogContentProps = PanelRenderProps<DeathsResult>;

export const DeathLogContent = (props: DeathLogContentProps) => {
  const { result, context, loading, processing, checkboxChecked } = props;

  // Build encounter name lookup
  const encounterNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const enc of context.instance.encounters) {
      map.set(enc.id, enc.name);
    }
    return map;
  }, [context.instance.encounters]);

  // Handle encounter link click
  const handleEncounterClick = useCallback((encounterId: string) => {
    context.onSelectEncounters?.([encounterId]);
  }, [context]);

  const { cachedValue: cachedResult, hasCache: hasData } = useCachedValue(
    result,
    (r) => r.DeathEvents.length > 0,
    []
  );

  // // Get the earliest encounter start time for timestamp calculation
  // const encounterStartTime = useMemo(() => {
  //   if (context.selectedEncounterIds.size === 0) {
  //     return new Date();
  //   }
  //   // Find the earliest start time among selected encounters
  //   const startTimes = context.selectedEncounters.map(
  //     (e) => new Date(e.start_time).getTime()
  //   );
  //   return new Date(Math.min(...startTimes));
  // }, [context.selectedEncounters]);

  const sortedDeaths = useMemo(() => {
    if (!cachedResult) return [];
    return getSortedDeathEvents(context.selectedEncounterIds, cachedResult);
  }, [context.selectedEncounterIds, cachedResult]);

  // Once we have cached data, never show loading/processing states
  const effectiveProps = {
    ...props,
    loading: hasData ? false : props.loading,
    processing: hasData ? false : props.processing,
  };

  return (
    <GenericPanel {...effectiveProps}>
      <div className="text-xs text-muted-foreground mb-2">
        Total Deaths: <span className="font-medium text-foreground">{sortedDeaths.length}</span>
      </div>

      {sortedDeaths.length === 0 ? (
        <div className="text-xs text-muted-foreground py-4 text-center">
          {loading || processing ? "Loading..." : "No deaths recorded"}
        </div>
      ) : (
        <ScrollArea className="max-h-[400px]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-1.5 px-2 font-medium w-16">Time</th>
                <th className="text-left py-1.5 px-2 font-medium w-16">Encounter</th>
                <th className="text-left py-1.5 px-2 font-medium w-28">Killed By</th>
                <th className="text-left py-1.5 px-2 font-medium">Player</th>
              </tr>
            </thead>
            <tbody>
              {sortedDeaths.map((death, index) => {
                const encounterName = encounterNames.get(death.encounterID) || "Unknown";
                const prevDeath = index > 0 ? sortedDeaths[index - 1] : null;
                const isNewEncounter = prevDeath && prevDeath.encounterID !== death.encounterID;
                return (
                  <tr
                    key={`${death.playerID}-${death.offsetMilli}-${index}`}
                    className={cn(
                      "border-b border-border/10 hover:bg-muted/50",
                      isNewEncounter && "border-t-2 border-t-border"
                    )}
                  >
                    <td className="py-1 px-2 tabular-nums text-muted-foreground font-mono text-2xs">
                      {checkboxChecked 
                        ? formatRelativeTime(death.offsetMilli)
                        : formatTimestamp(death.dateMilli)
                      }
                    </td>
                    <td className="py-1 px-2 max-w-[120px]">
                      <button
                        type="button"
                        onClick={() => handleEncounterClick(death.encounterID)}
                        className={cn(
                          "text-left text-2xs truncate max-w-full",
                          "text-blue-500 hover:text-blue-400 hover:underline cursor-pointer"
                        )}
                        title={`Select ${encounterName}`}
                      >
                        {encounterName}
                      </button>
                    </td>
                                        <td className="py-1 px-2 text-muted-foreground w-24 max-w-24">
                      {death.attribution ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="block truncate cursor-help underline decoration-dotted decoration-muted-foreground/50">
                              {death.killerName || "Unknown"}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="left" hideArrow className="max-w-[250px] bg-popover text-popover-foreground border border-border">
                            <div className="space-y-1">
                              <div className="font-medium">{death.killerName || "Unknown"}</div>
                              <div className="text-xs text-muted-foreground">{death.attribution.sourceName}</div>
                              <div className="flex items-center gap-2 text-xs">
                                <span className={cn("font-medium", getSchoolColor(death.attribution.school))}>
                                  {death.attribution.amount.toLocaleString()}
                                </span>
                                {death.attribution.school > 1 && (
                                  <span className="text-muted-foreground">
                                    {getSchoolName(death.attribution.school)}
                                  </span>
                                )}
                                {(death.attribution.hitType & HitTypeCrit) !== 0 && (
                                  <span className="text-yellow-500 font-medium">Crit!</span>
                                )}
                              </div>
                              {death.attribution.hitType !== 0 && (
                                <div className="text-2xs text-muted-foreground">
                                  {hitTypeNames(death.attribution.hitType).join(", ")}
                                </div>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="block truncate" title={death.killerName}>
                          {death.killerName || "Unknown"}
                        </span>
                      )}
                    </td>
                    <td className="py-1 px-2">
                      <span
                        className="font-medium"
                        style={{ color: `var(--class-${death.className.toLowerCase()})` }}
                      >
                        {death.playerName}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollArea>
      )}
    </GenericPanel>
  );
};
