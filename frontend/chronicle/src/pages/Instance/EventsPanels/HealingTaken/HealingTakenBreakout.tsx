import { useCallback, useState } from "react";
import { AbilityBreakout, type AbilityData, type TargetData, type BreakoutTab } from "@/components/ui/AbilityBreakout";
import type { UnifiedHealingResult } from "../processors";
import type { PanelContext } from "../types";
import type { HealingViewMode } from "./HealingTakenContent";

/**
 * Resolve a unit name from context, formatting pets as "{Owner}'s Pet {PetName}".
 */
function resolveUnitName(unitId: string, context: PanelContext): string {
  // Check if it's a player first
  if (context.instance.players?.[unitId]) {
    return context.instance.players[unitId].name;
  }
  // Check if it's a unit (could be a pet)
  const unitInfo = context.instance.units?.[unitId];
  if (unitInfo) {
    // If the unit has a player owner, format as pet
    const ownerKey = unitInfo.owner?.toString();
    if (ownerKey && context.instance.players?.[ownerKey]) {
      const ownerName = context.instance.players[ownerKey].name;
      return `${ownerName}'s Pet ${unitInfo.name}`;
    }
    return unitInfo.name;
  }
  return unitId;
}

/**
 * Convert the ByAbility map for a specific unit into AbilityData[] for the breakout.
 * Uses either effective or overheal data based on view mode.
 */
function getAbilitiesForUnit(
  result: UnifiedHealingResult,
  unitId: string,
  viewMode: HealingViewMode
): AbilityData[] {
  const effectiveAbilities = result.TargetByAbility.get(unitId);
  const overhealAbilities = result.TargetByAbilityOverheal.get(unitId);
  
  if (viewMode === "overheal") {
    if (!overhealAbilities) return [];
    const abilities: AbilityData[] = [];
    for (const [abilityName, data] of overhealAbilities) {
      abilities.push({
        ...data,
        name: abilityName,
        value: data.Total,
      });
    }
    return abilities.sort((a, b) => b.value - a.value);
  }
  
  if (viewMode === "total") {
    const combined = new Map<string, AbilityData>();
    
    if (effectiveAbilities) {
      for (const [abilityName, data] of effectiveAbilities) {
        combined.set(abilityName, {
          ...data,
          name: abilityName,
          value: data.Total,
        });
      }
    }
    
    if (overhealAbilities) {
      for (const [abilityName, data] of overhealAbilities) {
        const existing = combined.get(abilityName);
        if (existing) {
          existing.value += data.Total;
        } else {
          combined.set(abilityName, {
            ...data,
            name: abilityName,
            value: data.Total,
          });
        }
      }
    }
    
    return Array.from(combined.values()).sort((a, b) => b.value - a.value);
  }
  
  // Default: effective - include overheal as separate column
  if (!effectiveAbilities) return [];
  const abilities: AbilityData[] = [];
  for (const [abilityName, data] of effectiveAbilities) {
    const overhealData = overhealAbilities?.get(abilityName);
    abilities.push({
      ...data,
      name: abilityName,
      value: data.Total,
      overheal: overhealData?.Total,
    });
  }
  
  // Also add abilities that only have overheal (no effective healing)
  if (overhealAbilities) {
    for (const [abilityName, data] of overhealAbilities) {
      if (!effectiveAbilities?.has(abilityName)) {
        abilities.push({
          ...data,
          name: abilityName,
          value: 0,
          overheal: data.Total,
        });
      }
    }
  }

  return abilities.sort((a, b) => b.value - a.value);
}

/**
 * Get the total healing for a unit based on view mode.
 */
function getTotalForUnit(
  result: UnifiedHealingResult,
  unitId: string,
  viewMode: HealingViewMode
): number {
  const effectiveAbilities = result.TargetByAbility.get(unitId);
  const overhealAbilities = result.TargetByAbilityOverheal.get(unitId);
  
  let effectiveTotal = 0;
  let overhealTotal = 0;
  
  if (effectiveAbilities) {
    for (const data of effectiveAbilities.values()) {
      effectiveTotal += data.Total;
    }
  }
  
  if (overhealAbilities) {
    for (const data of overhealAbilities.values()) {
      overhealTotal += data.Total;
    }
  }
  
  switch (viewMode) {
    case "effective":
      return effectiveTotal;
    case "overheal":
      return overhealTotal;
    case "total":
      return effectiveTotal + overhealTotal;
  }
}

/**
 * Get source breakdown for a unit from BySource.
 * This shows who healed this unit (healer breakdown).
 */
function getSourcesForUnit(
  result: UnifiedHealingResult,
  unitId: string,
  context: PanelContext,
  viewMode: HealingViewMode
): TargetData[] {
  const effectiveSources = result.TargetBySource.get(unitId);
  const overhealSources = result.TargetBySourceOverheal.get(unitId);
  
  if (viewMode === "overheal") {
    if (!overhealSources) return [];
    const sources: TargetData[] = [];
    for (const [sourceId, value] of overhealSources) {
      const sourceName = resolveUnitName(sourceId, context);
      sources.push({ targetId: sourceId, targetName: sourceName, value, hitCount: 0, critCount: 0 });
    }
    return sources.sort((a, b) => b.value - a.value);
  }
  
  if (viewMode === "total") {
    const combined = new Map<string, TargetData>();
    
    if (effectiveSources) {
      for (const [sourceId, value] of effectiveSources) {
        const sourceName = resolveUnitName(sourceId, context);
        combined.set(sourceId, { targetId: sourceId, targetName: sourceName, value, hitCount: 0, critCount: 0 });
      }
    }
    
    if (overhealSources) {
      for (const [sourceId, value] of overhealSources) {
        const existing = combined.get(sourceId);
        if (existing) {
          existing.value += value;
        } else {
          const sourceName = resolveUnitName(sourceId, context);
          combined.set(sourceId, { targetId: sourceId, targetName: sourceName, value, hitCount: 0, critCount: 0 });
        }
      }
    }
    
    return Array.from(combined.values()).sort((a, b) => b.value - a.value);
  }
  
  // Default: effective only
  if (!effectiveSources) return [];
  const sources: TargetData[] = [];
  for (const [sourceId, value] of effectiveSources) {
    const sourceName = resolveUnitName(sourceId, context);
    sources.push({ targetId: sourceId, targetName: sourceName, value, hitCount: 0, critCount: 0 });
  }
  return sources.sort((a, b) => b.value - a.value);
}

export interface UseHealingTakenBreakoutOptions {
  result: UnifiedHealingResult | undefined;
  context: PanelContext;
  /** Label for the value column (e.g., "Healing", "HPS") */
  valueLabel?: string;
  perSecond?: boolean;
  durationMs?: number;
  loading?: boolean;
  processing?: boolean;
  /** View mode for healing display */
  viewMode?: HealingViewMode;
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
  viewMode = "effective",
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

      const abilities = getAbilitiesForUnit(result, playerID, viewMode);
      const sources = getSourcesForUnit(result, playerID, context, viewMode);
      const totalValue = getTotalForUnit(result, playerID, viewMode);

      // Convert to per-second if needed
      const displayAbilities = perSecond && durationMs
        ? abilities.map((a) => ({
            ...a,
            value: (a.value / durationMs) * 1000,
            overheal: a.overheal !== undefined ? (a.overheal / durationMs) * 1000 : undefined,
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

      const displayLabel = perSecond 
        ? (viewMode === "overheal" ? "OPS" : "HPS") 
        : valueLabel;

      return (
        <AbilityBreakout
          abilities={displayAbilities}
          targets={displaySources}
          totalValue={displayTotal}
          valueLabel={displayLabel}
          pinned={pinned}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          targetTabLabel={viewMode === "overheal" ? "Overhealed By" : "Healed By"}
          showHits={false}
          showOverheal={viewMode === "effective"}
        />
      );
    },
    [result, context, valueLabel, perSecond, durationMs, loading, processing, tabByPlayer, viewMode]
  );

  return breakout;
}
