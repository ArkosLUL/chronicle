import { useCallback, useState } from "react";
import { AbilityBreakout, type AbilityData, type TargetData, type BreakoutTab } from "@/components/ui/AbilityBreakout";
import type { HealingDoneResult } from "./healingDone.processor";
import type { PanelContext } from "../types";
import type { HealingViewMode } from "./HealingDoneContent";

/**
 * Convert the ByAbility map for a specific unit into AbilityData[] for the breakout.
 * Uses either effective or overheal data based on view mode.
 */
function getAbilitiesForUnit(
  result: HealingDoneResult,
  unitId: string,
  viewMode: HealingViewMode
): AbilityData[] {
  // Choose which ability map to use based on view mode
  const effectiveAbilities = result.ByAbility.get(unitId);
  const overhealAbilities = result.ByAbilityOverheal.get(unitId);
  
  if (viewMode === "overheal") {
    // Only show overhealing
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
    // Combine effective + overheal
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
    // Get overheal for this ability if it exists
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
  result: HealingDoneResult,
  unitId: string,
  viewMode: HealingViewMode
): number {
  const effectiveAbilities = result.ByAbility.get(unitId);
  const overhealAbilities = result.ByAbilityOverheal.get(unitId);
  
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
 * Get target breakdown for a unit from ByTarget.
 * This shows who received healing FROM this unit.
 */
function getTargetsForUnit(
  result: HealingDoneResult,
  unitId: string,
  context: PanelContext,
  viewMode: HealingViewMode
): TargetData[] {
  const effectiveTargets = result.ByTarget.get(unitId);
  const overhealTargets = result.ByTargetOverheal.get(unitId);
  
  if (viewMode === "overheal") {
    if (!overhealTargets) return [];
    const targets: TargetData[] = [];
    for (const [targetId, value] of overhealTargets) {
      let targetName = targetId;
      if (context.instance.players?.[targetId]) {
        targetName = context.instance.players[targetId].name;
      } else if (context.instance.units?.[targetId]) {
        targetName = context.instance.units[targetId].name;
      }
      targets.push({ targetId, targetName, value, hitCount: 0, critCount: 0 });
    }
    return targets.sort((a, b) => b.value - a.value);
  }
  
  if (viewMode === "total") {
    const combined = new Map<string, TargetData>();
    
    if (effectiveTargets) {
      for (const [targetId, value] of effectiveTargets) {
        let targetName = targetId;
        if (context.instance.players?.[targetId]) {
          targetName = context.instance.players[targetId].name;
        } else if (context.instance.units?.[targetId]) {
          targetName = context.instance.units[targetId].name;
        }
        combined.set(targetId, { targetId, targetName, value, hitCount: 0, critCount: 0 });
      }
    }
    
    if (overhealTargets) {
      for (const [targetId, value] of overhealTargets) {
        const existing = combined.get(targetId);
        if (existing) {
          existing.value += value;
        } else {
          let targetName = targetId;
          if (context.instance.players?.[targetId]) {
            targetName = context.instance.players[targetId].name;
          } else if (context.instance.units?.[targetId]) {
            targetName = context.instance.units[targetId].name;
          }
          combined.set(targetId, { targetId, targetName, value, hitCount: 0, critCount: 0 });
        }
      }
    }
    
    return Array.from(combined.values()).sort((a, b) => b.value - a.value);
  }
  
  // Default: effective only
  if (!effectiveTargets) return [];
  const targets: TargetData[] = [];
  for (const [targetId, value] of effectiveTargets) {
    let targetName = targetId;
    if (context.instance.players?.[targetId]) {
      targetName = context.instance.players[targetId].name;
    } else if (context.instance.units?.[targetId]) {
      targetName = context.instance.units[targetId].name;
    }
    targets.push({ targetId, targetName, value, hitCount: 0, critCount: 0 });
  }
  return targets.sort((a, b) => b.value - a.value);
}

export interface UseHealingDoneBreakoutOptions {
  result: HealingDoneResult | undefined;
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
 * Hook that creates a breakout function for healing done.
 * Returns a function compatible with PlayerMetricChart's breakout prop.
 */
export function useHealingDoneBreakout({
  result,
  context,
  valueLabel = "Healing",
  perSecond = false,
  durationMs,
  loading = false,
  processing = false,
  viewMode = "effective",
}: UseHealingDoneBreakoutOptions) {
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
      const targets = getTargetsForUnit(result, playerID, context, viewMode);
      const totalValue = getTotalForUnit(result, playerID, viewMode);

      // Convert to per-second if needed
      const displayAbilities = perSecond && durationMs
        ? abilities.map((a) => ({
            ...a,
            value: (a.value / durationMs) * 1000,
            overheal: a.overheal !== undefined ? (a.overheal / durationMs) * 1000 : undefined,
          }))
        : abilities;

      const displayTargets = perSecond && durationMs
        ? targets.map((t) => ({
            ...t,
            value: (t.value / durationMs) * 1000,
          }))
        : targets;

      const displayTotal = perSecond && durationMs
        ? (totalValue / durationMs) * 1000
        : totalValue;

      const displayLabel = perSecond 
        ? (viewMode === "overheal" ? "OPS" : "HPS") 
        : valueLabel;

      return (
        <AbilityBreakout
          abilities={displayAbilities}
          targets={displayTargets}
          totalValue={displayTotal}
          valueLabel={displayLabel}
          pinned={pinned}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          targetTabLabel={viewMode === "overheal" ? "Overhealed" : "Healed"}
          showHits={false}
          showOverheal={viewMode === "effective"}
        />
      );
    },
    [result, context, valueLabel, perSecond, durationMs, loading, processing, tabByPlayer, viewMode]
  );

  return breakout;
}
