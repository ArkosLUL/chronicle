import { useMemo } from "react";
import { PlayerMetricChart, type PlayerMetricChartData } from "@/components/ui/PlayerMetricChart/PlayerMetricChart";
import { GenericPanel } from "../GenericPanel";
import type { EntitySelection, PanelRenderProps } from "../types";
import type { DamageDoneResult } from "./damageDone.processor";
import { useCachedValue } from "@/hooks/useCachedValue";
import type { DamageSourceType } from "./damageDone.processor";

/**
 * Aggregate damage data across selected encounters.
 * Merges per-encounter data into a single map by player.
 * 
 * - If selected.enemyIds is non-empty, only sum damage dealt to those targets
 * - If selected.playerIds is non-empty, dim players not in selection
 */
function aggregateForEncounters(
  result: DamageDoneResult,
  selectedEncounterIds: string[],
  selected: EntitySelection,
): PlayerMetricChartData[] {
  const aggregated = new Map<string, PlayerMetricChartData>();
  
  const filterByEnemy = selected.enemyIds.size > 0;
  const hasPlayerSelection = selected.playerIds.size > 0;
  
  for (const encounterId of selectedEncounterIds) {
    const encounterDamage = result.EncounterDamage.get(encounterId);
    if (!encounterDamage) continue;
    
    for (const [playerId, data] of encounterDamage) {
      // Calculate damage - either filtered by target or total
      let damageValue = 0;
      if (filterByEnemy) {
        // Sum only damage to selected enemies
        for (const [targetId, amount] of data.target) {
          if (selected.enemyIds.has(targetId)) {
            damageValue += amount;
          }
        }
      } else {
        // Sum all damage (no enemy filter)
        for (const amount of data.target.values()) {
          damageValue += amount;
        }
      }
      
      // Skip players with zero damage after filtering
      if (damageValue === 0) continue;
      
      const existing = aggregated.get(playerId);
      if (existing) {
        existing.value += damageValue;
      } else {
        aggregated.set(playerId, {
          playerID: data.playerID,
          playerName: data.playerName,
          className: data.className,
          specialization: data.specialization,
          value: damageValue,
          dimmed: hasPlayerSelection && !selected.playerIds.has(playerId),
        });
      }
    }
  }
  
  return Array.from(aggregated.values());
}


interface DamageDoneContentProps extends PanelRenderProps<DamageDoneResult> {
  sourceType?: DamageSourceType;
}

export const DamageDoneContent = (props: DamageDoneContentProps) => {
  const { sourceType = "players" } = props;
  const { result, context } = props;
  
  const { cachedValue: cachedResult, hasCache: hasData } = useCachedValue(
    result,
    (r) => r.EncounterDamage.size > 0,
    [sourceType]
  );

  const damageData = useMemo(() => {
    return aggregateForEncounters(cachedResult, context.selectedEncounterIds, context.entitySelection);
  }, [cachedResult, context.selectedEncounterIds, context.entitySelection]);

  // Once we have cached data, never show loading/processing states
  const effectiveProps = {
    ...props,
    loading: hasData ? false : props.loading,
    processing: hasData ? false : props.processing,
  };

  return (
    <GenericPanel {...effectiveProps}>
      <PlayerMetricChart 
        data={damageData} 
        type={"damage"} 
        panelTitle="Damage Done"
        duration_millis={props.durationMs}
        perSecond={props.perSecond}
      />
    </GenericPanel>
  );
}