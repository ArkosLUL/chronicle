import { useCallback } from "react";
import { cn } from "@/lib/utils";
import type { ExtraAttacksResult, ExtraAttacksData } from "./extraAttacks.processor";
import type { PanelContext } from "../types";

// ============================================================================
// Types
// ============================================================================

/**
 * Ability data for display in the extra attacks breakout table.
 */
interface ExtraAttackAbilityDisplay {
  name: string;
  count: number;       // Number of proc events
  totalAttacks: number; // Total extra attacks granted
}

// ============================================================================
// Extra Attack Ability Table
// ============================================================================

interface ExtraAttackTableProps {
  abilities: ExtraAttackAbilityDisplay[];
  totalProcs: number;
  totalAttacks: number;
}

/**
 * Table showing ability-by-ability breakdown of extra attack sources.
 * @internal - Not exported, only used within breakout
 */
// eslint-disable-next-line react-refresh/only-export-components
function ExtraAttackTable({ 
  abilities, 
  totalProcs,
  totalAttacks,
}: ExtraAttackTableProps) {
  if (!abilities || abilities.length === 0) {
    return <p className="text-xs p-2 text-muted-foreground">No ability breakdown available</p>;
  }

  // Sort by total attacks descending
  const sorted = [...abilities].sort((a, b) => b.totalAttacks - a.totalAttacks);

  return (
    <div className="max-h-64 overflow-y-auto">
      <table className="w-full text-xs text-foreground">
        <thead className="sticky top-0 bg-popover">
          <tr className="border-b border-border">
            <th className="text-left py-1.5 px-2 font-medium">Source</th>
            <th className="text-right py-1.5 px-2 font-medium">Procs</th>
            <th className="text-right py-1.5 px-2 font-medium">Attacks</th>
            <th className="text-right py-1.5 px-2 font-medium">%</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((ability) => {
            const attackPercent = totalAttacks > 0 ? (ability.totalAttacks / totalAttacks) * 100 : 0;
            
            return (
              <tr key={ability.name} className="border-b border-border/10 hover:bg-muted/50">
                <td className="py-1 px-2 max-w-[150px] truncate" title={ability.name}>
                  {ability.name}
                </td>
                <td className="text-right py-1 px-2 tabular-nums">
                  {ability.count.toLocaleString()}
                </td>
                <td className="text-right py-1 px-2 tabular-nums">
                  {ability.totalAttacks.toLocaleString()}
                </td>
                <td className="text-right py-1 px-2 tabular-nums text-muted-foreground">
                  {attackPercent.toFixed(1)}%
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="border-t border-border">
          <tr className="font-medium">
            <td className="py-1 px-2">Total</td>
            <td className="text-right py-1 px-2 tabular-nums">{totalProcs.toLocaleString()}</td>
            <td className="text-right py-1 px-2 tabular-nums">{totalAttacks.toLocaleString()}</td>
            <td className="text-right py-1 px-2 tabular-nums text-muted-foreground">100%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ============================================================================
// Breakout Component
// ============================================================================

interface ExtraAttacksBreakoutProps {
  abilities: ExtraAttackAbilityDisplay[];
  totalProcs: number;
  totalAttacks: number;
}

/**
 * Breakout panel for extra attacks showing source abilities.
 * @internal - Not exported, only used within hook
 */
// eslint-disable-next-line react-refresh/only-export-components
function ExtraAttacksBreakout({
  abilities,
  totalProcs,
  totalAttacks,
}: ExtraAttacksBreakoutProps) {
  const tabClass = "px-2 py-1 text-2xs font-medium transition-colors";
  const activeTabClass = "text-foreground border-b-2 border-foreground";

  return (
    <div>
      <div className="flex items-center border-b border-border">
        <span className={cn(tabClass, activeTabClass)}>By Source</span>
        <span className="text-2xs ml-auto pr-1.5 text-muted-foreground">
          Total: <span className="font-medium tabular-nums text-foreground">{totalAttacks}</span> attacks
        </span>
      </div>
      <ExtraAttackTable
        abilities={abilities}
        totalProcs={totalProcs}
        totalAttacks={totalAttacks}
      />
    </div>
  );
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Get the aggregated extra attacks data for a player across selected encounters.
 */
function getExtraAttacksForPlayer(
  result: ExtraAttacksResult,
  playerID: string,
  selectedEncounterIds: string[]
): ExtraAttacksData | null {
  // Aggregate abilities across encounters
  const aggregatedAbilities = new Map<string, { count: number; totalAttacks: number }>();
  let totalProcs = 0;
  let totalAttacks = 0;

  for (const encounterId of selectedEncounterIds) {
    const encounterData = result.EncounterExtraAttacks.get(encounterId);
    if (!encounterData) continue;

    const playerData = encounterData.get(playerID);
    if (!playerData) continue;

    totalProcs += playerData.totalProcs;
    totalAttacks += playerData.totalAttacks;

    for (const [abilityName, abilityData] of playerData.abilities) {
      const existing = aggregatedAbilities.get(abilityName) || { count: 0, totalAttacks: 0 };
      existing.count += abilityData.count;
      existing.totalAttacks += abilityData.totalAttacks;
      aggregatedAbilities.set(abilityName, existing);
    }
  }

  if (totalProcs === 0) return null;

  return {
    playerID,
    playerName: "",
    className: "",
    totalProcs,
    totalAttacks,
    abilities: new Map(
      Array.from(aggregatedAbilities.entries()).map(([name, data]) => [
        name,
        { name, count: data.count, totalAttacks: data.totalAttacks },
      ])
    ),
  };
}

export interface UseExtraAttacksBreakoutOptions {
  result: ExtraAttacksResult | undefined;
  context: PanelContext;
  loading?: boolean;
  processing?: boolean;
}

/**
 * Hook that creates a breakout function for extra attacks.
 * Returns a function compatible with PlayerMetricChart's breakout prop.
 */
export function useExtraAttacksBreakout({
  result,
  context,
  loading = false,
  processing = false,
}: UseExtraAttacksBreakoutOptions) {
  const breakout = useCallback(
    (playerID: string) => {
      if (loading || processing) {
        return (
          <div className="p-4 flex items-center justify-center text-xs text-muted-foreground min-w-[300px] min-h-[200px]">
            {loading ? "Loading..." : "Processing..."}
          </div>
        );
      }

      if (!result) {
        return (
          <p className="text-xs p-2 text-muted-foreground">No breakdown available</p>
        );
      }

      const playerData = getExtraAttacksForPlayer(
        result,
        playerID,
        context.selectedEncounterIds
      );

      if (!playerData) {
        return (
          <p className="text-xs p-2 text-muted-foreground">No extra attacks data</p>
        );
      }

      const abilities: ExtraAttackAbilityDisplay[] = Array.from(
        playerData.abilities.values()
      );

      return (
        <ExtraAttacksBreakout
          abilities={abilities}
          totalProcs={playerData.totalProcs}
          totalAttacks={playerData.totalAttacks}
        />
      );
    },
    [result, context.selectedEncounterIds, loading, processing]
  );

  return breakout;
}
