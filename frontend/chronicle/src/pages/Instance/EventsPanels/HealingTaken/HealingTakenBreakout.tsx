import { useCallback, useState } from "react";
import { AbilityBreakout, type AbilityData, type TargetData, type BreakoutTab } from "@/components/ui/AbilityBreakout";
import type { HealingTakenResult } from "./healingTaken.processor";
import type { PanelContext } from "../types";

/**
 * Convert the ByAbility map for a specific unit into AbilityData[] for the breakout.
 */
function getAbilitiesForUnit(
  result: HealingTakenResult,
  unitId: string
): AbilityData[] {
  const unitAbilities = result.ByAbility.get(unitId);
  if (!unitAbilities) return [];

  const abilities: AbilityData[] = [];
  for (const [abilityName, data] of unitAbilities) {
    abilities.push({
      ...data,
      name: abilityName,
      value: data.Total,
    });
  }

  return abilities.sort((a, b) => b.value - a.value);
}

/**
 * Get the total healing for a unit from the ByAbility map.
 */
function getTotalForUnit(
  result: HealingTakenResult,
  unitId: string
): number {
  const unitAbilities = result.ByAbility.get(unitId);
  if (!unitAbilities) return 0;

  let total = 0;
  for (const data of unitAbilities.values()) {
    total += data.Total;
  }
  return total;
}

/**
 * Get source breakdown for a unit from BySource.
 * This shows who healed this unit (healer breakdown).
 */
function getSourcesForUnit(
  result: HealingTakenResult,
  unitId: string,
  context: PanelContext
): TargetData[] {
  const unitSources = result.BySource.get(unitId);
  if (!unitSources) return [];
  
  const sources: TargetData[] = [];
  for (const [sourceId, value] of unitSources) {
    // Try to resolve source name from players or units
    let sourceName = sourceId;
    if (context.instance.players?.[sourceId]) {
      sourceName = context.instance.players[sourceId].name;
    } else if (context.instance.units?.[sourceId]) {
      sourceName = context.instance.units[sourceId].name;
    }
    
    sources.push({
      targetId: sourceId,
      targetName: sourceName,
      value,
      hitCount: 0,
      critCount: 0,
    });
  }
  
  return sources.sort((a, b) => b.value - a.value);
}

export interface UseHealingTakenBreakoutOptions {
  result: HealingTakenResult | undefined;
  context: PanelContext;
  /** Label for the value column (e.g., "Healing", "HPS") */
  valueLabel?: string;
  perSecond?: boolean;
  durationMs?: number;
  loading?: boolean;
  processing?: boolean;
}

/**
 * Hook that creates a breakout function for healing taken.
 * Returns a function compatible with PlayerMetricChart's breakout prop.
 */
export function useHealingTakenBreakout({
  result,
  context,
  valueLabel = "Healing",
  perSecond = false,
  durationMs,
  loading = false,
  processing = false,
}: UseHealingTakenBreakoutOptions) {
  // Track tab selection per player so it persists across reloads
  const [tabByPlayer, setTabByPlayer] = useState<Map<string, BreakoutTab>>(new Map());
  
  const breakout = useCallback(
    (playerID: string, pinned: boolean) => {
      const activeTab = tabByPlayer.get(playerID) ?? 'ability';
      const setActiveTab = (tab: BreakoutTab) => {
        setTabByPlayer(prev => new Map(prev).set(playerID, tab));
      };
      if (loading || processing) {
        return (
          <div className="p-4 flex items-center justify-center text-xs text-muted-foreground min-w-[300px] min-h-[200px]">
            {loading ? "Loading..." : "Processing..."}
          </div>
        );
      }
      
      if (!result) {
        return (
          <p className="text-xs p-2 text-background/60">No breakdown available</p>
        );
      }

      const abilities = getAbilitiesForUnit(result, playerID);
      const sources = getSourcesForUnit(result, playerID, context);
      const totalValue = getTotalForUnit(result, playerID);

      // Convert to per-second if needed
      const displayAbilities = perSecond && durationMs
        ? abilities.map((a) => ({
            ...a,
            value: (a.value / durationMs) * 1000,
          }))
        : abilities;

      const displaySources = perSecond && durationMs
        ? sources.map((t) => ({
            ...t,
            value: (t.value / durationMs) * 1000,
          }))
        : sources;

      const displayTotal = perSecond && durationMs
        ? (totalValue / durationMs) * 1000
        : totalValue;

      const displayLabel = perSecond ? "HPS" : valueLabel;

      return (
        <AbilityBreakout
          abilities={displayAbilities}
          targets={displaySources}
          totalValue={displayTotal}
          valueLabel={displayLabel}
          pinned={pinned}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          targetTabLabel="Healed By"
        />
      );
    },
    [result, context, valueLabel, perSecond, durationMs, loading, processing, tabByPlayer]
  );

  return breakout;
}
