import { useMemo } from "react";
import { PlayerMetricChart, type PlayerMetricChartData } from "@/components/ui/PlayerMetricChart/PlayerMetricChart";
import { GenericPanel } from "../GenericPanel";
import type { EntitySelection, PanelRenderProps } from "../types";
import type { DamageDoneResult, DamageSourceType } from "./damageDone.processor";
import { useCachedValue } from "@/hooks/useCachedValue";
import { useDamageDoneBreakout } from "./DamageDoneBreakout";
import { formatNumber } from "@/lib/format";

/**
 * Aggregate damage data across selected encounters.
 * Merges per-encounter data into a single map by player.
 * 
 * - If selected.enemyIds is non-empty, only sum damage dealt to those targets
 * - If selected.playerIds is non-empty, dim players not in selection
 */
function aggregateForEncounters(
  sourceType: DamageSourceType,
  result: DamageDoneResult,
  selectedEncounterIds: string[],
  selected: EntitySelection,
): PlayerMetricChartData[] {
  const aggregated = new Map<string, PlayerMetricChartData>();
  
  let targets = selected.enemyIds;
  let subjects = selected.playerIds;
  if(sourceType === "enemies") {
    targets = selected.playerIds;
    subjects = selected.enemyIds;
  }


  const filterByTarget = targets.size > 0;
  const hasSubjectSelection = subjects.size > 0;
  
  for (const encounterId of selectedEncounterIds) {
    const encounterDamage = result.EncounterDamage.get(encounterId);
    if (!encounterDamage) continue;
    
    for (const [playerId, data] of encounterDamage) {
      // Calculate damage - either filtered by target or total
      let damageValue = 0;
      if (filterByTarget) {
        // Sum only damage to selected enemies
        for (const [targetId, amount] of data.target) {
          if (targets.has(targetId)) {
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
          dimmed: hasSubjectSelection && !subjects.has(playerId),
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
    if (!cachedResult) return [];
    return aggregateForEncounters(sourceType, cachedResult, context.selectedEncounterIds, context.entitySelection);
  }, [sourceType, cachedResult, context.selectedEncounterIds, context.entitySelection]);

  // Create breakout function for tooltips
  const breakout = useDamageDoneBreakout({
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

  // Compute display total
  const total = damageData.reduce((sum, d) => sum + d.value, 0);
  const displayTotal = props.perSecond && props.durationMs
    ? formatNumber(total / (props.durationMs / 1000), 1)
    : formatNumber(total, 0);

  return (
    <GenericPanel {...effectiveProps}>
      <div className="text-xs text-muted-foreground">
        Total: <span className="font-medium text-foreground">{displayTotal}{props.perSecond ? '/s' : ''}</span>
      </div>
      <PlayerMetricChart 
        data={damageData} 
        type={"damage"} 
        panelTitle="Damage Done"
        duration_millis={props.durationMs}
        perSecond={props.perSecond}
        breakout={breakout}
      />
    </GenericPanel>
  );
}