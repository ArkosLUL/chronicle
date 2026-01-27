import { useCallback } from "react";
import { AbilityBreakout, type AbilityData, type TargetData } from "@/components/ui/AbilityBreakout";
import type { DamageDoneResult } from "./damageDone.processor";
import type { PanelContext } from "../types";

/**
 * Convert the ByAbility map for a specific unit into AbilityData[] for the breakout.
 * 
 * ByAbility structure: Map<unitId, Map<abilityName, DamageAbilityBreakout>>
 */
function getAbilitiesForUnit(
  result: DamageDoneResult,
  unitId: string
): AbilityData[] {
  const unitAbilities = result.ByAbility.get(unitId);
  if (!unitAbilities) return [];

  const abilities: AbilityData[] = [];
  for (const [abilityName, data] of unitAbilities) {
    abilities.push({
      name: abilityName,
      value: data.Total,
      hitCount: data.Count,
      critCount: 0, // TODO: Add crit tracking to processor
    });
  }

  return abilities.sort((a, b) => b.value - a.value);
}

/**
 * Get the total damage for a unit from the ByAbility map.
 */
function getTotalForUnit(
  result: DamageDoneResult,
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
 * Get target breakdown for a unit from ByTarget.
 */
function getTargetsForUnit(
  result: DamageDoneResult,
  unitId: string,
  context: PanelContext
): TargetData[] {
  const unitTargets = result.ByTarget.get(unitId);
  if (!unitTargets) return [];
  
  const targets: TargetData[] = [];
  for (const [targetId, value] of unitTargets) {
    // Try to resolve target name from players or units
    let targetName = targetId;
    if (context.instance.players?.[targetId]) {
      targetName = context.instance.players[targetId].name;
    } else if (context.instance.units?.[targetId]) {
      targetName = context.instance.units[targetId].name;
    }
    
    targets.push({
      targetId,
      targetName,
      value,
      hitCount: 0, // TODO: Track hit counts per target in processor
      critCount: 0,
    });
  }
  
  return targets.sort((a, b) => b.value - a.value);
}

export interface UseDamageDoneBreakoutOptions {
  result: DamageDoneResult | undefined;
  context: PanelContext;
  /** Label for the value column (e.g., "Damage", "DPS") */
  valueLabel?: string;
  perSecond?: boolean;
  durationMs?: number;
  loading?: boolean;
  processing?: boolean;
}

/**
 * Hook that creates a breakout function for damage done.
 * Returns a function compatible with PlayerMetricChart's breakout prop.
 */
export function useDamageDoneBreakout({
  result,
  context,
  valueLabel = "Damage",
  perSecond = false,
  durationMs,
  loading = false,
  processing = false,
}: UseDamageDoneBreakoutOptions) {
  const breakout = useCallback(
    (playerID: string, pinned: boolean) => {
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
      const targets = getTargetsForUnit(result, playerID, context);
      const totalValue = getTotalForUnit(result, playerID);

      // Convert to per-second if needed
      const displayAbilities = perSecond && durationMs
        ? abilities.map((a) => ({
            ...a,
            value: (a.value / durationMs) * 1000,
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

      const displayLabel = perSecond ? "DPS" : valueLabel;

      return (
        <AbilityBreakout
          abilities={displayAbilities}
          targets={displayTargets}
          totalValue={displayTotal}
          valueLabel={displayLabel}
          invertedColors
          pinned={pinned}
        />
      );
    },
    [result, context, valueLabel, perSecond, durationMs, loading, processing]
  );

  return breakout;
}
