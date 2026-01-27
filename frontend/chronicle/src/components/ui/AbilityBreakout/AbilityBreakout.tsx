import { useState } from 'react'
import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

/**
 * Ability data for display in the breakout table.
 * This is a simplified structure compared to the old AbilityBreakdown.
 */
export interface AbilityData {
  name: string
  value: number
  hitCount: number
  critCount: number
  missCount?: number
  dodgeCount?: number
  parryCount?: number
  // Add more fields as needed
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
  /** When true, uses inverted colors for dark background tooltips */
  invertedColors?: boolean
}

/**
 * Table showing ability-by-ability breakdown.
 */
export function AbilityTable({ 
  abilities, 
  totalValue,
  valueLabel = 'Value',
  invertedColors = false,
}: AbilityTableProps) {
  if (!abilities || abilities.length === 0) {
    const emptyClass = invertedColors ? "text-background/60" : "text-muted-foreground"
    return <p className={cn("text-xs p-2", emptyClass)}>No ability breakdown available</p>
  }

  // Sort by value descending
  const sorted = [...abilities].sort((a, b) => b.value - a.value)

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
            <th className="text-right py-1.5 px-2 font-medium">{valueLabel}</th>
            <th className="text-right py-1.5 px-2 font-medium">%</th>
            <th className="text-right py-1.5 px-2 font-medium">Count</th>
            <th className="text-right py-1.5 px-2 font-medium">Crit%</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((ability) => {
            const totalHits = ability.hitCount + ability.critCount
            const critPercent = totalHits > 0 ? (ability.critCount / totalHits) * 100 : 0
            const valuePercent = totalValue > 0 ? (ability.value / totalValue) * 100 : 0
            
            return (
              <tr key={ability.name} className={cn("border-b", borderClass.replace("20", "10"), hoverClass)}>
                <td className="py-1 px-2 max-w-[150px] truncate" title={ability.name}>
                  {ability.name}
                </td>
                <td className="text-right py-1 px-2 tabular-nums">
                  {ability.value.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                </td>
                <td className={cn("text-right py-1 px-2 tabular-nums", mutedClass)}>
                  {valuePercent.toFixed(1)}%
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
// Target Table Component
// ============================================================================

export interface TargetTableProps {
  targets: TargetData[]
  totalValue: number
  /** Label for the value column (e.g., "Damage", "Healing") */
  valueLabel?: string
  /** When true, uses inverted colors for dark background tooltips */
  invertedColors?: boolean
}

/**
 * Table showing breakdown by target.
 */
export function TargetTable({ 
  targets, 
  totalValue, 
  valueLabel = 'Value',
  invertedColors = false, 
}: TargetTableProps) {
  if (!targets || targets.length === 0) {
    const emptyClass = invertedColors ? "text-background/60" : "text-muted-foreground"
    return <p className={cn("text-xs p-2", emptyClass)}>No target breakdown available</p>
  }

  // Sort by value descending
  const sorted = [...targets].sort((a, b) => b.value - a.value)

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
            <th className="text-right py-1.5 px-2 font-medium">{valueLabel}</th>
            <th className="text-right py-1.5 px-2 font-medium">%</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((target) => {
            const valuePercent = totalValue > 0 ? (target.value / totalValue) * 100 : 0
            
            return (
              <tr key={target.targetId} className={cn("border-b", borderClass.replace("20", "10"), hoverClass)}>
                <td className="py-1 px-2 max-w-[150px] truncate" title={target.targetName}>
                  {target.targetName}
                </td>
                <td className="text-right py-1 px-2 tabular-nums">
                  {target.value.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                </td>
                <td className={cn("text-right py-1 px-2 tabular-nums", mutedClass)}>
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
  /** When true, uses inverted colors for dark background tooltips */
  invertedColors?: boolean
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
  return value.toLocaleString()
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
  invertedColors = false,
  pinned: _pinned = false,
  activeTab: controlledTab,
  onTabChange,
}: AbilityBreakoutProps) {
  const [internalTab, setInternalTab] = useState<BreakoutTab>('ability')
  
  // Use controlled or uncontrolled tab state
  const activeTab = controlledTab ?? internalTab
  const setActiveTab = onTabChange ?? setInternalTab
  
  const hasTargets = targets && targets.length > 0
  
  const tabClass = "px-3 py-1.5 text-xs font-medium transition-colors"
  const activeTabClass = invertedColors
    ? "text-background border-b-2 border-background"
    : "text-foreground border-b-2 border-foreground"
  const inactiveTabClass = invertedColors
    ? "text-background/60 hover:text-background/80"
    : "text-muted-foreground hover:text-foreground"
  const borderClass = invertedColors ? "border-background/20" : "border-border"
  const mutedClass = invertedColors ? "text-background/60" : "text-muted-foreground"
  const textClass = invertedColors ? "text-background" : "text-foreground"

  const totalHeader = (
    <div className={cn("px-2 py-1.5 text-xs flex justify-between items-center", borderClass, "border-b")}>
      <span className={mutedClass}>Total {valueLabel}</span>
      <span className={cn("font-medium tabular-nums", textClass)}>{formatValue(totalValue)}</span>
    </div>
  )

  // If no targets, just show the ability table without tabs
  if (!hasTargets) {
    return (
      <div>
        {totalHeader}
        <AbilityTable
          abilities={abilities}
          totalValue={totalValue}
          valueLabel={valueLabel}
          invertedColors={invertedColors}
        />
      </div>
    )
  }

  return (
    <div>
      {totalHeader}
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
        <AbilityTable
          abilities={abilities}
          totalValue={totalValue}
          valueLabel={valueLabel}
          invertedColors={invertedColors}
        />
      ) : (
        <TargetTable
          targets={targets}
          totalValue={totalValue}
          valueLabel={valueLabel}
          invertedColors={invertedColors}
        />
      )}
    </div>
  )
}
