import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import type { Ability } from '@/api/typesGenerated'

// ============================================================================
// Types
// ============================================================================

/**
 * Ability breakdown for display in tables
 */
export interface AbilityBreakdown {
  name: string
  totalDamage: number
  hitCount: number
  critCount: number
  missCount: number
  dodgeCount: number
  immuneCount: number
  parryCount: number
  otherCount: number
}

/**
 * Raw abilities record type from API: { [targetGUID]: { [abilityName]: Ability } }
 */
export type RawAbilities = Record<string, Record<string, Ability>>

// ============================================================================
// Utility Functions
// ============================================================================

function mergeAbility(target: Ability, source: Ability): Ability {
  return {
    total: target.total + source.total,
    hit_count: target.hit_count + source.hit_count,
    crit_count: target.crit_count + source.crit_count,
    miss_count: target.miss_count + source.miss_count,
    dodge_count: target.dodge_count + source.dodge_count,
    immune_count: target.immune_count + source.immune_count,
    parry_count: target.parry_count + source.parry_count,
    other_count: target.other_count + source.other_count,
  }
}

/**
 * Convert rawAbilities (nested by target GUID, then ability name) into a flat
 * AbilityBreakdown[] aggregated across all targets.
 */
export function computeAbilityBreakdown(rawAbilities: RawAbilities | undefined): AbilityBreakdown[] {
  if (!rawAbilities) return []
  
  // Aggregate abilities across all targets
  const byAbilityName = new Map<string, Ability>()
  
  for (const targetAbilities of Object.values(rawAbilities)) {
    for (const [abilityName, ability] of Object.entries(targetAbilities)) {
      const existing = byAbilityName.get(abilityName)
      if (existing) {
        byAbilityName.set(abilityName, mergeAbility(existing, ability))
      } else {
        byAbilityName.set(abilityName, { ...ability })
      }
    }
  }
  
  // Convert to AbilityBreakdown[] and sort by total damage descending
  return Array.from(byAbilityName.entries())
    .map(([name, ability]) => ({
      name,
      totalDamage: ability.total,
      hitCount: ability.hit_count,
      critCount: ability.crit_count,
      missCount: ability.miss_count,
      dodgeCount: ability.dodge_count,
      immuneCount: ability.immune_count,
      parryCount: ability.parry_count,
      otherCount: ability.other_count,
    }))
    .sort((a, b) => b.totalDamage - a.totalDamage)
}

// ============================================================================
// Ability Breakdown Table
// ============================================================================

export interface AbilityBreakdownTableProps {
  abilities: AbilityBreakdown[]
  totalValue: number
  invertedColors?: boolean
  perSecond?: boolean
  durationMillis?: number
}

/**
 * Table showing ability-by-ability damage breakdown.
 * invertedColors: when true, uses bg-foreground/text-background (for tooltips with dark bg)
 */
export function AbilityBreakdownTable({ 
  abilities, 
  totalValue,
  invertedColors = false,
  perSecond = false,
  durationMillis,
}: AbilityBreakdownTableProps) {
  if (!abilities || abilities.length === 0) {
    const emptyClass = invertedColors ? "text-background/60" : "text-muted-foreground"
    return <p className={cn("text-xs p-2", emptyClass)}>No ability breakdown available</p>
  }

  // Sort by damage descending
  const sorted = [...abilities].sort((a, b) => b.totalDamage - a.totalDamage)

  // Color classes based on inverted mode
  const textClass = invertedColors ? "text-background" : "text-foreground"
  const mutedClass = invertedColors ? "text-background/60" : "text-muted-foreground"
  const headerBgClass = invertedColors ? "bg-foreground" : "bg-popover"
  const borderClass = invertedColors ? "border-background/20" : "border-border"
  const hoverClass = invertedColors ? "hover:bg-background/10" : "hover:bg-muted/50"

  return (
    <div className="max-h-64 overflow-y-auto">
      <table className={cn("w-full text-xs", textClass)}>
        <thead className={cn("sticky top-0", headerBgClass)}>
          <tr className={cn("border-b", borderClass)}>
            <th className="text-left py-1.5 px-2 font-medium">Ability</th>
            <th className="text-right py-1.5 px-2 font-medium">{perSecond ? 'DPS' : 'Damage'}</th>
            <th className="text-right py-1.5 px-2 font-medium">%</th>
            <th className="text-right py-1.5 px-2 font-medium">Count</th>
            <th className="text-right py-1.5 px-2 font-medium">Crit%</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((ability) => {
            const totalHits = ability.hitCount + ability.critCount
            const critPercent = totalHits > 0 ? (ability.critCount / totalHits) * 100 : 0
            const displayDamage = perSecond && durationMillis ? (ability.totalDamage / durationMillis) * 1000 : ability.totalDamage
            const damagePercent = totalValue > 0 ? (displayDamage / totalValue) * 100 : 0
            
            return (
              <tr key={ability.name} className={cn("border-b", borderClass.replace("20", "10"), hoverClass)}>
                <td className="py-1 px-2 max-w-[150px] truncate" title={ability.name}>
                  {ability.name}
                </td>
                <td className="text-right py-1 px-2 tabular-nums">
                  {displayDamage.toLocaleString()}
                </td>
                <td className={cn("text-right py-1 px-2 tabular-nums", mutedClass)}>
                  {damagePercent.toFixed(1)}%
                </td>
                <td className="text-right py-1 px-2 tabular-nums">
                  {totalHits}
                </td>
                <td className="text-right py-1 px-2 tabular-nums">
                  {critPercent.toFixed(0)}%
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ============================================================================
// Target Breakdown Table
// ============================================================================

export interface TargetBreakdownTableProps {
  rawAbilities?: RawAbilities
  targetNames?: Map<string, string>
  totalValue: number
  invertedColors?: boolean
  perSecond?: boolean
  durationMillis?: number
}

/**
 * Table showing damage grouped by target.
 */
export function TargetBreakdownTable({ 
  rawAbilities, 
  targetNames,
  totalValue, 
  invertedColors = false, 
  perSecond = false, 
  durationMillis 
}: TargetBreakdownTableProps) {
  // Compute target breakdown from rawAbilities
  const targets = useMemo(() => {
    if (!rawAbilities) return []
    
    const byTarget = new Map<string, { totalDamage: number; hitCount: number; critCount: number }>()
    
    for (const [targetGuid, abilities] of Object.entries(rawAbilities)) {
      let totalDamage = 0
      let hitCount = 0
      let critCount = 0
      
      for (const ability of Object.values(abilities)) {
        totalDamage += ability.total
        hitCount += ability.hit_count
        critCount += ability.crit_count
      }
      
      const existing = byTarget.get(targetGuid)
      if (existing) {
        existing.totalDamage += totalDamage
        existing.hitCount += hitCount
        existing.critCount += critCount
      } else {
        byTarget.set(targetGuid, { totalDamage, hitCount, critCount })
      }
    }
    
    return Array.from(byTarget.entries())
      .map(([guid, stats]) => ({
        targetGuid: guid,
        targetName: targetNames?.get(guid) || `Unknown (${guid.slice(-8)})`,
        ...stats,
      }))
      .sort((a, b) => b.totalDamage - a.totalDamage)
  }, [rawAbilities, targetNames])

  if (targets.length === 0) {
    const emptyClass = invertedColors ? "text-background/60" : "text-muted-foreground"
    return <p className={cn("text-xs p-2", emptyClass)}>No target breakdown available</p>
  }

  // Color classes based on inverted mode
  const textClass = invertedColors ? "text-background" : "text-foreground"
  const mutedClass = invertedColors ? "text-background/60" : "text-muted-foreground"
  const headerBgClass = invertedColors ? "bg-foreground" : "bg-popover"
  const borderClass = invertedColors ? "border-background/20" : "border-border"
  const hoverClass = invertedColors ? "hover:bg-background/10" : "hover:bg-muted/50"

  return (
    <div className="max-h-64 overflow-y-auto">
      <table className={cn("w-full text-xs", textClass)}>
        <thead className={cn("sticky top-0", headerBgClass)}>
          <tr className={cn("border-b", borderClass)}>
            <th className="text-left py-1.5 px-2 font-medium">Target</th>
            <th className="text-right py-1.5 px-2 font-medium">{perSecond ? 'DPS' : 'Damage'}</th>
            <th className="text-right py-1.5 px-2 font-medium">%</th>
            <th className="text-right py-1.5 px-2 font-medium">Count</th>
            <th className="text-right py-1.5 px-2 font-medium">Crit%</th>
          </tr>
        </thead>
        <tbody>
          {targets.map((target) => {
            const totalHits = target.hitCount + target.critCount
            const critPercent = totalHits > 0 ? (target.critCount / totalHits) * 100 : 0
            const displayDamage = perSecond && durationMillis ? (target.totalDamage / durationMillis) * 1000 : target.totalDamage
            const damagePercent = totalValue > 0 ? (displayDamage / totalValue) * 100 : 0
            
            return (
              <tr key={target.targetGuid} className={cn("border-b", borderClass.replace("20", "10"), hoverClass)}>
                <td className="py-1 px-2 max-w-[150px] truncate" title={target.targetName}>
                  {target.targetName}
                </td>
                <td className="text-right py-1 px-2 tabular-nums">
                  {displayDamage.toLocaleString()}
                </td>
                <td className={cn("text-right py-1 px-2 tabular-nums", mutedClass)}>
                  {damagePercent.toFixed(1)}%
                </td>
                <td className="text-right py-1 px-2 tabular-nums">
                  {totalHits}
                </td>
                <td className="text-right py-1 px-2 tabular-nums">
                  {critPercent.toFixed(0)}%
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ============================================================================
// Tabbed Breakdown Table
// ============================================================================

type BreakdownTab = 'ability' | 'target'

export interface TabbedBreakdownTableProps {
  abilities: AbilityBreakdown[]
  rawAbilities?: RawAbilities
  targetNames?: Map<string, string>
  totalValue: number
  invertedColors?: boolean
  perSecond?: boolean
  durationMillis?: number
}

/**
 * Tabbed breakdown component - switches between Ability and Target views.
 */
export function TabbedBreakdownTable({
  abilities,
  rawAbilities,
  targetNames,
  totalValue,
  invertedColors = false,
  perSecond = false,
  durationMillis,
}: TabbedBreakdownTableProps) {
  const [activeTab, setActiveTab] = useState<BreakdownTab>('ability')
  
  const tabClass = "px-3 py-1.5 text-xs font-medium transition-colors"
  const activeTabClass = invertedColors
    ? "text-background border-b-2 border-background"
    : "text-foreground border-b-2 border-foreground"
  const inactiveTabClass = invertedColors
    ? "text-background/60 hover:text-background/80"
    : "text-muted-foreground hover:text-foreground"
  const borderClass = invertedColors ? "border-background/20" : "border-border"

  return (
    <div>
      <div className={cn("flex border-b", borderClass)}>
        <button
          className={cn(tabClass, activeTab === 'ability' ? activeTabClass : inactiveTabClass)}
          onClick={() => setActiveTab('ability')}
        >
          By Ability
        </button>
        <button
          className={cn(tabClass, activeTab === 'target' ? activeTabClass : inactiveTabClass)}
          onClick={() => setActiveTab('target')}
        >
          By Target
        </button>
      </div>
      {activeTab === 'ability' ? (
        <AbilityBreakdownTable
          abilities={abilities}
          totalValue={totalValue}
          invertedColors={invertedColors}
          perSecond={perSecond}
          durationMillis={durationMillis}
        />
      ) : (
        <TargetBreakdownTable
          rawAbilities={rawAbilities}
          targetNames={targetNames}
          totalValue={totalValue}
          invertedColors={invertedColors}
          perSecond={perSecond}
          durationMillis={durationMillis}
        />
      )}
    </div>
  )
}
