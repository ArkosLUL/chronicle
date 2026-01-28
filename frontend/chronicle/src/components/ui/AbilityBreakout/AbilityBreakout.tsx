import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { DamageAbilityBreakout } from '@/pages/Instance/EventsPanels/DamageDone/damageDone.processor'

// ============================================================================
// Types
// ============================================================================

/**
 * Ability data for display in the breakout table.
 * This is a simplified structure compared to the old AbilityBreakdown.
 */
export interface AbilityData extends DamageAbilityBreakout{
  name: string
  value: number
}

/**
 * Target breakdown data for "By Target" tab.
 */
export interface TargetData {
  targetId: string
  targetName: string
  value: number
  hitCount: number
  critCount: number
}

// ============================================================================
// Ability Table Component
// ============================================================================

export interface AbilityTableProps {
  abilities: AbilityData[]
  totalValue: number
  /** Label for the value column (e.g., "Damage", "Healing", "DPS", "HPS") */
  valueLabel?: string
}

/**
 * Table showing ability-by-ability breakdown.
 */
export function AbilityTable({ 
  abilities, 
  totalValue,
  valueLabel = 'Value',
}: AbilityTableProps) {
  if (!abilities || abilities.length === 0) {
    return <p className="text-xs p-2 text-muted-foreground">No ability breakdown available</p>
  }

  // Sort by value descending
  const sorted = [...abilities].sort((a, b) => b.value - a.value)

  return (
    <div className="max-h-64 overflow-y-auto">
      <table className="w-full text-xs text-foreground">
        <thead className="sticky top-0 bg-popover">
          <tr className="border-b border-border">
            <th className="text-left py-1.5 px-2 font-medium">Ability</th>
            <th className="text-right py-1.5 px-2 font-medium">{valueLabel}</th>
            <th className="text-right py-1.5 px-2 font-medium">%</th>
            <th className="text-right py-1.5 px-2 font-medium">Count</th>
            <th className="text-right py-1.5 px-2 font-medium">Hits</th>
            <th className="text-right py-1.5 px-2 font-medium">Crit%</th>
            {/* <th className="text-right py-1.5 px-2 font-medium">Miss%</th> */}
          </tr>
        </thead>
        <tbody>
          {sorted.map((ability) => {
            const critPercent = ability.Hits > 0 ? (ability.Crits / ability.Hits) * 100 : 0
            // const missPercent = totalAttempts > 0 ? (missCount + / totalAttempts) * 100 : 0
            const valuePercent = totalValue > 0 ? (ability.value / totalValue) * 100 : 0
            
            return (
              <tr key={ability.name} className="border-b border-border/10 hover:bg-muted/50">
                <td className="py-1 px-2 max-w-[150px] truncate" title={ability.name}>
                  {ability.name}
                </td>
                <td className="text-right py-1 px-2 tabular-nums">
                  {ability.value.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                </td>
                <td className="text-right py-1 px-2 tabular-nums text-muted-foreground">
                  {valuePercent.toFixed(1)}%
                </td>
                <td className="text-right py-1 px-2 tabular-nums">
                  {ability.Count}
                </td>
                <td className="text-right py-1 px-2 tabular-nums">
                  {ability.Hits} 
                </td>
                <td className="text-right py-1 px-2 tabular-nums">
                  {critPercent.toFixed(0)}%
                </td>
                {/* <td className="text-right py-1 px-2 tabular-nums">
                  {missPercent.toFixed(0)}%
                </td> */}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ============================================================================
// Target Table Component
// ============================================================================

export interface TargetTableProps {
  targets: TargetData[]
  totalValue: number
  /** Label for the value column (e.g., "Damage", "Healing") */
  valueLabel?: string
}

/**
 * Table showing breakdown by target.
 */
export function TargetTable({ 
  targets, 
  totalValue, 
  valueLabel = 'Value',
}: TargetTableProps) {
  if (!targets || targets.length === 0) {
    return <p className="text-xs p-2 text-muted-foreground">No target breakdown available</p>
  }

  // Sort by value descending
  const sorted = [...targets].sort((a, b) => b.value - a.value)

  return (
    <div className="max-h-64 overflow-y-auto">
      <table className="w-full text-xs text-foreground">
        <thead className="sticky top-0 bg-popover">
          <tr className="border-b border-border">
            <th className="text-left py-1.5 px-2 font-medium">Target</th>
            <th className="text-right py-1.5 px-2 font-medium">{valueLabel}</th>
            <th className="text-right py-1.5 px-2 font-medium">%</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((target) => {
            const valuePercent = totalValue > 0 ? (target.value / totalValue) * 100 : 0
            
            return (
              <tr key={target.targetId} className="border-b border-border/10 hover:bg-muted/50">
                <td className="py-1 px-2 max-w-[150px] truncate" title={target.targetName}>
                  {target.targetName}
                </td>
                <td className="text-right py-1 px-2 tabular-nums">
                  {target.value.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                </td>
                <td className="text-right py-1 px-2 tabular-nums text-muted-foreground">
                  {valuePercent.toFixed(1)}%
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
// Tabbed Breakout Component
// ============================================================================

export type BreakoutTab = 'ability' | 'target'

export interface AbilityBreakoutProps {
  abilities: AbilityData[]
  targets?: TargetData[]
  totalValue: number
  /** Label for the value column (e.g., "Damage", "Healing", "DPS", "HPS") */
  valueLabel?: string
  /** Whether this is a pinned breakout (for potential styling differences) */
  pinned?: boolean
  /** Controlled active tab (optional - defaults to internal state) */
  activeTab?: BreakoutTab
  /** Callback when tab changes (required if activeTab is controlled) */
  onTabChange?: (tab: BreakoutTab) => void
}

function formatValue(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

/**
 * Tabbed breakout component - switches between Ability and Target views.
 * This is the main component to use for player breakouts.
 */
export function AbilityBreakout({
  abilities,
  targets,
  totalValue,
  valueLabel = 'Value',
  pinned: _pinned = false,
  activeTab: controlledTab,
  onTabChange,
}: AbilityBreakoutProps) {
  const [internalTab, setInternalTab] = useState<BreakoutTab>('ability')
  
  // Use controlled or uncontrolled tab state
  const activeTab = controlledTab ?? internalTab
  const setActiveTab = onTabChange ?? setInternalTab
  
  const hasTargets = targets && targets.length > 0
  
  const tabClass = "px-2 py-1 text-2xs font-medium transition-colors"
  const activeTabClass = "text-foreground border-b-2 border-foreground"
  const inactiveTabClass = "text-muted-foreground hover:text-foreground"

  const totalDisplay = (
    <span className="text-2xs ml-auto pr-1.5 text-muted-foreground">
      Total: <span className="font-medium tabular-nums text-foreground">{formatValue(totalValue)}</span>
    </span>
  )

  // If no targets, just show the ability table without tabs
  if (!hasTargets) {
    return (
      <div>
        <div className="flex items-center border-b border-border">
          <span className={cn(tabClass, activeTabClass)}>By Ability</span>
          {totalDisplay}
        </div>
        <AbilityTable
          abilities={abilities}
          totalValue={totalValue}
          valueLabel={valueLabel}
        />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center border-b border-border">
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
        {totalDisplay}
      </div>
      {activeTab === 'ability' ? (
        <AbilityTable
          abilities={abilities}
          totalValue={totalValue}
          valueLabel={valueLabel}
        />
      ) : (
        <TargetTable
          targets={targets}
          totalValue={totalValue}
          valueLabel={valueLabel}
        />
      )}
    </div>
  )
}
