import { useMemo } from "react";
import { PlayerMetricChart, type PlayerMetricChartData } from "@/components/ui/PlayerMetricChart/PlayerMetricChart";
import { GenericPanel } from "../GenericPanel";
import type { EntitySelection, PanelRenderProps } from "../types";
import type { HealingDoneResult, HealingSourceType } from "./healingDone.processor";
import { useCachedValue } from "@/hooks/useCachedValue";
import { useHealingDoneBreakout } from "./HealingDoneBreakout";
import { formatNumber } from "@/lib/format";

/**
 * Aggregate healing data across selected encounters.
 * Merges per-encounter data into a single map by player.
 * 
 * - If selected.playerIds is non-empty, only sum healing done to those targets
 * - Healers not in selection are dimmed
 */
function aggregateForEncounters(
  result: HealingDoneResult,
  selectedEncounterIds: string[],
  selected: EntitySelection,
): PlayerMetricChartData[] {
  const aggregated = new Map<string, PlayerMetricChartData>();
  
  const filterByTarget = selected.playerIds.size > 0;
  const hasHealerSelection = selected.playerIds.size > 0;
  
  for (const encounterId of selectedEncounterIds) {
    const encounterHealing = result.EncounterHealing.get(encounterId);
    if (!encounterHealing) continue;
    
    for (const [playerId, data] of encounterHealing) {
      // Calculate healing - either filtered by target or total
      let healingValue = 0;
      if (filterByTarget) {
        // Sum only healing to selected players
        for (const [targetId, amount] of data.target) {
          if (selected.playerIds.has(targetId)) {
            healingValue += amount;
          }
        }
      } else {
        // Sum all healing (no target filter)
        for (const amount of data.target.values()) {
          healingValue += amount;
        }
      }
      
      // Skip players with zero healing after filtering
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
          // Never dim for healing, since we are selecting targets.
          // dimmed: hasHealerSelection && !selected.playerIds.has(playerId),
        });
      }
    }
  }
  
  return Array.from(aggregated.values());
}


interface HealingDoneContentProps extends PanelRenderProps<HealingDoneResult> {
  sourceType?: HealingSourceType;
}

export const HealingDoneContent = (props: HealingDoneContentProps) => {
  const { sourceType = "players" } = props;
  const { result, context } = props;
  
  const { cachedValue: cachedResult, hasCache: hasData } = useCachedValue(
    result,
    (r) => r.EncounterHealing.size > 0,
    [sourceType]
  );

  const healingData = useMemo(() => {
    if (!cachedResult) return [];
    return aggregateForEncounters(cachedResult, context.selectedEncounterIds, context.entitySelection);
  }, [cachedResult, context.selectedEncounterIds, context.entitySelection]);

  // Create breakout function for tooltips
  const breakout = useHealingDoneBreakout({
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
        panelTitle="Healing Done"
        duration_millis={props.durationMs}
        perSecond={props.perSecond}
        breakout={breakout}
      />
    </GenericPanel>
  );
}
