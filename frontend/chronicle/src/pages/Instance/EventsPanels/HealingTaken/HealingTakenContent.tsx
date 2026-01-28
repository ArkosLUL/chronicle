import { useMemo } from "react";
import { PlayerMetricChart, type PlayerMetricChartData } from "@/components/ui/PlayerMetricChart/PlayerMetricChart";
import { GenericPanel } from "../GenericPanel";
import type { EntitySelection, PanelRenderProps } from "../types";
import type { HealingTakenResult, HealingTargetType } from "./healingTaken.processor";
import { useCachedValue } from "@/hooks/useCachedValue";
import { useHealingTakenBreakout } from "./HealingTakenBreakout";
import { formatNumber } from "@/lib/format";

/**
 * Aggregate healing taken data across selected encounters.
 * Merges per-encounter data into a single map by player (who received healing).
 * 
 * - If selected.playerIds is non-empty, only include those players
 */
function aggregateForEncounters(
  result: HealingTakenResult,
  selectedEncounterIds: string[],
  selected: EntitySelection,
): PlayerMetricChartData[] {
  const aggregated = new Map<string, PlayerMetricChartData>();
  
  const filterByPlayer = selected.playerIds.size > 0;
  
  for (const encounterId of selectedEncounterIds) {
    const encounterHealing = result.EncounterHealing.get(encounterId);
    if (!encounterHealing) continue;
    
    for (const [playerId, data] of encounterHealing) {
      // Filter by selected players if applicable
      if (filterByPlayer && !selected.playerIds.has(playerId)) {
        continue;
      }
      
      // Calculate total healing received
      let healingValue = 0;
      for (const amount of data.source.values()) {
        healingValue += amount;
      }
      
      // Skip players with zero healing
      if (healingValue === 0) continue;
      
      const existing = aggregated.get(playerId);
      if (existing) {
        existing.value += healingValue;
      } else {
        aggregated.set(playerId, {
          playerID: data.playerID,
          playerName: data.playerName,
          className: data.className,
          specialization: data.specialization,
          value: healingValue,
        });
      }
    }
  }
  
  return Array.from(aggregated.values());
}


interface HealingTakenContentProps extends PanelRenderProps<HealingTakenResult> {
  targetType?: HealingTargetType;
}

export const HealingTakenContent = (props: HealingTakenContentProps) => {
  const { targetType = "players" } = props;
  const { result, context } = props;
  
  const { cachedValue: cachedResult, hasCache: hasData } = useCachedValue(
    result,
    (r) => r.EncounterHealing.size > 0,
    [targetType]
  );

  const healingData = useMemo(() => {
    if (!cachedResult) return [];
    return aggregateForEncounters(cachedResult, context.selectedEncounterIds, context.entitySelection);
  }, [cachedResult, context.selectedEncounterIds, context.entitySelection]);

  // Create breakout function for tooltips
  const breakout = useHealingTakenBreakout({
    result: result,
    context: context,
    valueLabel: "Healing",
    perSecond: props.perSecond,
    durationMs: props.durationMs,
    loading: props.loading,
    processing: props.processing,
  });

  // Once we have cached data, never show loading/processing states
  const effectiveProps = {
    ...props,
    loading: hasData ? false : props.loading,
    processing: hasData ? false : props.processing,
  };

  // Compute display total
  const total = healingData.reduce((sum, d) => sum + d.value, 0);
  const displayTotal = props.perSecond && props.durationMs
    ? formatNumber(total / (props.durationMs / 1000), 1)
    : formatNumber(total, 0);

  return (
    <GenericPanel {...effectiveProps}>
      <div className="text-xs text-muted-foreground">
        Total: <span className="font-medium text-foreground">{displayTotal}{props.perSecond ? '/s' : ''}</span>
      </div>
      <PlayerMetricChart 
        data={healingData} 
        type={"healing"} 
        panelTitle="Healing Taken"
        duration_millis={props.durationMs}
        perSecond={props.perSecond}
        breakout={breakout}
      />
    </GenericPanel>
  );
}
