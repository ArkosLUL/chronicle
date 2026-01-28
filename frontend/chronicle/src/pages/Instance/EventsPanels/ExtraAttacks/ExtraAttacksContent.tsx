import { useMemo } from "react";
import { PlayerMetricChart, type PlayerMetricChartData } from "@/components/ui/PlayerMetricChart/PlayerMetricChart";
import { GenericPanel } from "../GenericPanel";
import type { PanelRenderProps } from "../types";
import type { ExtraAttacksResult } from "./extraAttacks.processor";
import { useCachedValue } from "@/hooks/useCachedValue";
import { formatNumber } from "@/lib/format";

/**
 * Aggregate extra attacks data across selected encounters.
 */
function aggregateForEncounters(
  result: ExtraAttacksResult,
  selectedEncounterIds: string[],
): PlayerMetricChartData[] {
  const aggregated = new Map<string, PlayerMetricChartData>();
  
  for (const encounterId of selectedEncounterIds) {
    const encounterData = result.EncounterExtraAttacks.get(encounterId);
    if (!encounterData) continue;
    
    for (const [playerId, data] of encounterData) {
      const existing = aggregated.get(playerId);
      if (existing) {
        existing.value += data.totalProcs;
      } else {
        aggregated.set(playerId, {
          playerID: data.playerID,
          playerName: data.playerName,
          className: data.className,
          specialization: "",
          value: data.totalProcs,
          dimmed: false,
        });
      }
    }
  }
  
  return Array.from(aggregated.values());
}


interface ExtraAttacksContentProps extends PanelRenderProps<ExtraAttacksResult> {}

export const ExtraAttacksContent = (props: ExtraAttacksContentProps) => {
  const { result, context } = props;
  
  const { cachedValue: cachedResult, hasCache: hasData } = useCachedValue(
    result,
    (r) => r.EncounterExtraAttacks.size > 0,
    []
  );

  const extraAttacksData = useMemo(() => {
    if (!cachedResult) return [];
    return aggregateForEncounters(cachedResult, context.selectedEncounterIds);
  }, [cachedResult, context.selectedEncounterIds]);

  // Once we have cached data, never show loading/processing states
  const effectiveProps = {
    ...props,
    loading: hasData ? false : props.loading,
    processing: hasData ? false : props.processing,
  };

  // Compute display total
  const total = extraAttacksData.reduce((sum, d) => sum + d.value, 0);
  const displayTotal = formatNumber(total, 0);

  return (
    <GenericPanel {...effectiveProps}>
      <div className="text-xs text-muted-foreground">
        Total Procs: <span className="font-medium text-foreground">{displayTotal}</span>
      </div>
      <PlayerMetricChart 
        data={extraAttacksData} 
        type={"healing"} // Use healing color (green) to distinguish from damage
        panelTitle="Extra Attacks"
        duration_millis={props.durationMs}
        perSecond={props.perSecond}
      />
    </GenericPanel>
  );
}
