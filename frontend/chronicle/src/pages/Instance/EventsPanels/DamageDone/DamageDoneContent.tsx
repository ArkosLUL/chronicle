import { useEffect, useMemo, useRef } from "react";
import { PlayerMetricChart, type PlayerMetricChartData } from "@/components/ui/PlayerMetricChart/PlayerMetricChart";
import { GenericPanel } from "../GenericPanel";
import type { PanelRenderProps } from "../types";
import type { DamageDoneResult, DamageDoneData } from "./damageDone.processor";

/**
 * Aggregate damage data across selected encounters.
 * Merges per-encounter data into a single map by player.
 */
function aggregateForEncounters(
  result: DamageDoneResult,
  selectedEncounterIds: string[]
): PlayerMetricChartData[] {
  const aggregated = new Map<string, DamageDoneData>();
  
  for (const encounterId of selectedEncounterIds) {
    const encounterDamage = result.EncounterDamage.get(encounterId);
    if (!encounterDamage) continue;
    
    for (const [playerId, data] of encounterDamage) {
      const existing = aggregated.get(playerId);
      if (existing) {
        existing.value += data.value;
      } else {
        // Copy to avoid mutating the original
        aggregated.set(playerId, { ...data });
      }
    }
  }
  
  return Array.from(aggregated.values());
}

export const DamageDoneContent = (props: PanelRenderProps<DamageDoneResult>) => {
  const { result, context } = props;
  
  // Cache the result once it has data - never update after that.
  // This ensures the reference stays stable across re-renders.
  const staticResultRef = useRef<DamageDoneResult | null>(null);
  if (staticResultRef.current === null && result.EncounterDamage.size > 0) {
    staticResultRef.current = result;
  }
  
  // Use cached result (stable reference), fallback to live result if not yet cached
  const effectiveResult = staticResultRef.current ?? result;

  const damageData = useMemo(() => {
    return aggregateForEncounters(effectiveResult, context.selectedEncounterIds);
  }, [effectiveResult, context.selectedEncounterIds]);

  // Once we have cached data, never show loading/processing states
  const hasData = staticResultRef.current !== null;
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