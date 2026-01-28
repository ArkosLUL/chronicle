import { useMemo } from "react";
import { PlayerMetricChart, type PlayerMetricChartData } from "@/components/ui/PlayerMetricChart/PlayerMetricChart";
import { GenericPanel } from "../GenericPanel";
import type { EntitySelection, PanelRenderProps } from "../types";
import type { DamageTakenResult, DamageTargetType } from "./damageTaken.processor";
import { useCachedValue } from "@/hooks/useCachedValue";
import { useDamageTakenBreakout } from "./DamageTakenBreakout";

/**
 * Aggregate damage taken data across selected encounters.
 * Merges per-encounter data into a single map by unit.
 * 
 * - If selected.playerIds is non-empty (for players view), only include those players
 * - If selected.enemyIds is non-empty (for enemies view), only include those enemies
 */
function aggregateForEncounters(
  result: DamageTakenResult,
  selectedEncounterIds: string[],
  selected: EntitySelection,
  targetType: DamageTargetType,
): PlayerMetricChartData[] {
  const aggregated = new Map<string, PlayerMetricChartData>();
  
  const filterBySource = targetType === "players" 
    ? selected.enemyIds.size > 0 
    : selected.playerIds.size > 0;
  
  const hasUnitSelection = targetType === "players"
    ? selected.playerIds.size > 0
    : selected.enemyIds.size > 0;
  
  for (const encounterId of selectedEncounterIds) {
    const encounterDamage = result.EncounterDamage.get(encounterId);
    if (!encounterDamage) continue;
    
    for (const [unitId, data] of encounterDamage) {
      // Calculate damage - either filtered by source or total
      let damageValue = 0;
      if (filterBySource) {
        // Sum only damage from selected sources
        const sourceFilter = targetType === "players" ? selected.enemyIds : selected.playerIds;
        for (const [sourceId, amount] of data.source) {
          if (sourceFilter.has(sourceId)) {
            damageValue += amount;
          }
        }
      } else {
        // Sum all damage (no source filter)
        for (const amount of data.source.values()) {
          damageValue += amount;
        }
      }
      
      // Skip units with zero damage after filtering
      if (damageValue === 0) continue;
      
      const existing = aggregated.get(unitId);
      if (existing) {
        existing.value += damageValue;
      } else {
        const unitSelection = targetType === "players" ? selected.playerIds : selected.enemyIds;
        aggregated.set(unitId, {
          playerID: data.unitID,
          playerName: data.unitName,
          className: data.className,
          specialization: data.specialization,
          value: damageValue,
          dimmed: hasUnitSelection && !unitSelection.has(unitId),
        });
      }
    }
  }
  
  return Array.from(aggregated.values());
}


interface DamageTakenContentProps extends PanelRenderProps<DamageTakenResult> {
  targetType?: DamageTargetType;
}

export const DamageTakenContent = (props: DamageTakenContentProps) => {
  const { targetType = "players" } = props;
  const { result, context } = props;
  
  const { cachedValue: cachedResult, hasCache: hasData } = useCachedValue(
    result,
    (r) => r.EncounterDamage.size > 0,
    [targetType]
  );

  const damageData = useMemo(() => {
    if (!cachedResult) return [];
    return aggregateForEncounters(cachedResult, context.selectedEncounterIds, context.entitySelection, targetType);
  }, [cachedResult, context.selectedEncounterIds, context.entitySelection, targetType]);

  // Create breakout function for tooltips
  const breakout = useDamageTakenBreakout({
    result: result,
    context: context,
    valueLabel: "Damage",
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

  const panelTitle = targetType === "players" ? "Damage Taken" : "Enemy Damage Taken";

  return (
    <GenericPanel {...effectiveProps}>
      <PlayerMetricChart 
        data={damageData} 
        type={"damage"} 
        panelTitle={panelTitle}
        duration_millis={props.durationMs}
        perSecond={props.perSecond}
        breakout={breakout}
      />
    </GenericPanel>
  );
}
