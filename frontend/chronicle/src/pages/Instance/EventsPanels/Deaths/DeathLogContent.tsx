/**
 * DeathLogContent - Chronological list of player deaths with timestamps
 */

import { useMemo } from "react";
import { GenericPanel } from "../GenericPanel";
import type { PanelRenderProps } from "../types";
import type { DeathsResult, DeathEvent } from "./deaths.processor";
import { useCachedValue } from "@/hooks/useCachedValue";


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
 * Sort death events by offsetMilli and return chronological list.
 */
function getSortedDeathEvents(selectedEncounterIDs:string[], result: DeathsResult): DeathEvent[] {
  // DeathEvents is already populated for selected encounters
  return [...result.DeathEvents].filter((event) => selectedEncounterIDs.includes(event.encounterID)) // sort((a, b) => a.offsetMilli - b.offsetMilli);
}

type DeathLogContentProps = PanelRenderProps<DeathsResult>;

export const DeathLogContent = (props: DeathLogContentProps) => {
  const { result, context, loading, processing } = props;

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
        <div className="max-h-[400px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-1.5 px-2 font-medium w-16">Time</th>
                <th className="text-left py-1.5 px-2 font-medium w-16">Offset</th>
                <th className="text-left py-1.5 px-2 font-medium">Player</th>
                <th className="text-left py-1.5 px-2 font-medium">Killed By</th>
              </tr>
            </thead>
            <tbody>
              {sortedDeaths.map((death, index) => (
                  <tr
                    key={`${death.playerID}-${death.offsetMilli}-${index}`}
                    className="border-b border-border/10 hover:bg-muted/50"
                  >
                    <td className="py-1 px-2 tabular-nums text-muted-foreground font-mono text-2xs">
                      {formatTimestamp(death.dateMilli)}
                    </td>
                    <td className="py-1 px-2 tabular-nums text-muted-foreground font-mono text-2xs">
                      {formatRelativeTime(death.offsetMilli)}
                    </td>
                    <td className="py-1 px-2">
                      <span
                        className="font-medium"
                        style={{ color: `var(--class-${death.className.toLowerCase()})` }}
                      >
                        {death.playerName}
                      </span>
                    </td>
                    <td className="py-1 px-2 text-muted-foreground max-w-[150px] truncate" title={death.killerName}>
                      {death.killerName || "Unknown"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </GenericPanel>
  );
};
