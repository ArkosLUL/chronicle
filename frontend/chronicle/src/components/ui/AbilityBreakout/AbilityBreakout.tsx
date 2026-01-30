import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { DamageAbilityBreakout } from '@/pages/Instance/EventsPanels/DamageDone/damageDone.processor'
import { useBreakoutHover, getCellHighlight, type BreakoutHoverState } from './BreakoutHoverContext'

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
  /** Optional overheal value - displayed in a separate column with distinct styling */
  overheal?: number
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
  /** Optional overheal value - displayed in a separate column with distinct styling */
  overheal?: number
}

// ============================================================================
// Highlight Styles
// ============================================================================

/** Get highlight class based on cell state */
function getHighlightClass(highlight: ReturnType<typeof getCellHighlight>): string {
  switch (highlight) {
    case 'intersection':
      return 'bg-primary/25'
    case 'row':
      return 'bg-primary/5'
    case 'column':
      return 'bg-primary/5'
    default:
      return ''
  }
}

/** HoverCell component that handles mouse events */
function HoverCell({
  rowId,
  columnId,
  hover,
  setHover,
  clearHover,
  className,
  children,
  ...props
}: {
  rowId: string
  columnId: string
  hover: BreakoutHoverState
  setHover: (state: BreakoutHoverState) => void
  clearHover: () => void
  className?: string
  children: React.ReactNode
} & React.TdHTMLAttributes<HTMLTableCellElement>) {
  const highlight = getCellHighlight(hover, rowId, columnId)
  
  return (
    <td
      className={cn(className, getHighlightClass(highlight))}
      onMouseEnter={() => setHover({ rowId, columnId })}
      onMouseLeave={clearHover}
      {...props}
    >
      {children}
    </td>
  )
}

// ============================================================================
// Ability Table Component
// ============================================================================

export interface AbilityTableProps {
  abilities: AbilityData[]
  totalValue: number
  /** Label for the value column (e.g., "Damage", "Healing", "DPS", "HPS") */
  valueLabel?: string
  /** Whether to show the Hits column (damage can miss, heals cannot) */
  showHits?: boolean
  /** Whether to show the overheal column (only for healing in effective mode) */
  showOverheal?: boolean
}

/**
 * Table showing ability-by-ability breakdown.
 */
export function AbilityTable({ 
  abilities, 
  totalValue,
  valueLabel = 'Value',
  showHits = true,
  showOverheal = false,
}: AbilityTableProps) {
  const { hover, setHover, clearHover } = useBreakoutHover()
  
  if (!abilities || abilities.length === 0) {
    return <p className="text-xs p-2 text-muted-foreground">No ability breakdown available</p>
  }

  // Sort by value descending
  const sorted = [...abilities].sort((a, b) => b.value - a.value)
  
  // Check if any ability has overheal data
  const hasOverhealData = showOverheal && sorted.some(a => a.overheal !== undefined && a.overheal > 0)

  // Column IDs for hover tracking
  const COL = {
    ABILITY: 'ability',
    OVERHEAL: 'overheal',
    VALUE: 'value',
    PERCENT: 'percent',
    COUNT: 'count',
    HITS: 'hits',
    CRIT: 'crit',
  }

  return (
    <div className="max-h-64 overflow-y-auto">
      <table className="w-full text-xs text-foreground">
        <thead className="sticky top-0 bg-popover z-10">
          <tr className="border-b border-border">
            <th className={cn("text-left py-1.5 px-2 font-medium", hover.columnId === COL.ABILITY && "bg-primary/20")}>Ability</th>
            {hasOverhealData && (
              <th className={cn("text-right py-1.5 px-2 font-medium text-yellow-500/80", hover.columnId === COL.OVERHEAL && "bg-primary/20")}>Overheal</th>
            )}
            <th className={cn("text-right py-1.5 px-2 font-medium", hover.columnId === COL.VALUE && "bg-primary/20")}>{valueLabel}</th>
            <th className={cn("text-right py-1.5 px-2 font-medium", hover.columnId === COL.PERCENT && "bg-primary/20")}>%</th>
            <th className={cn("text-right py-1.5 px-2 font-medium", hover.columnId === COL.COUNT && "bg-primary/20")}>Count</th>
            {showHits && (
              <th className={cn("text-right py-1.5 px-2 font-medium", hover.columnId === COL.HITS && "bg-primary/20")}>Hits</th>
            )}
            <th className={cn("text-right py-1.5 px-2 font-medium", hover.columnId === COL.CRIT && "bg-primary/20")}>Crit%</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((ability) => {
            const critPercent = ability.Hits > 0 ? (ability.Crits / ability.Hits) * 100 : 0
            const valuePercent = totalValue > 0 ? (ability.value / totalValue) * 100 : 0
            const rowId = ability.name
            
            return (
              <tr key={ability.name} className="border-b border-border/10">
                <HoverCell
                  rowId={rowId}
                  columnId={COL.ABILITY}
                  hover={hover}
                  setHover={setHover}
                  clearHover={clearHover}
                  className="py-1 px-2 max-w-[150px] truncate"
                  title={ability.name}
                >
                  {ability.name}
                </HoverCell>
                {hasOverhealData && (() => {
                  const overhealVal = ability.overheal ?? 0;
                  const totalForAbility = ability.value + overhealVal;
                  const overhealPct = totalForAbility > 0 ? (overhealVal / totalForAbility) * 100 : 0;
                  return (
                    <HoverCell
                      rowId={rowId}
                      columnId={COL.OVERHEAL}
                      hover={hover}
                      setHover={setHover}
                      clearHover={clearHover}
                      className="text-right py-1 px-2 tabular-nums text-yellow-500/70"
                    >
                      {overhealVal.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      <span className="text-yellow-500/50 ml-1">({overhealPct.toFixed(0)}%)</span>
                    </HoverCell>
                  );
                })()}
                <HoverCell
                  rowId={rowId}
                  columnId={COL.VALUE}
                  hover={hover}
                  setHover={setHover}
                  clearHover={clearHover}
                  className="text-right py-1 px-2 tabular-nums"
                >
                  {ability.value.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                </HoverCell>
                <HoverCell
                  rowId={rowId}
                  columnId={COL.PERCENT}
                  hover={hover}
                  setHover={setHover}
                  clearHover={clearHover}
                  className="text-right py-1 px-2 tabular-nums text-muted-foreground"
                >
                  {valuePercent.toFixed(1)}%
                </HoverCell>
                <HoverCell
                  rowId={rowId}
                  columnId={COL.COUNT}
                  hover={hover}
                  setHover={setHover}
                  clearHover={clearHover}
                  className="text-right py-1 px-2 tabular-nums"
                >
                  {ability.Count}
                </HoverCell>
                {showHits && (
                  <HoverCell
                    rowId={rowId}
                    columnId={COL.HITS}
                    hover={hover}
                    setHover={setHover}
                    clearHover={clearHover}
                    className="text-right py-1 px-2 tabular-nums"
                  >
                    {ability.Hits}
                  </HoverCell>
                )}
                <HoverCell
                  rowId={rowId}
                  columnId={COL.CRIT}
                  hover={hover}
                  setHover={setHover}
                  clearHover={clearHover}
                  className="text-right py-1 px-2 tabular-nums"
                >
                  {critPercent.toFixed(0)}%
                </HoverCell>
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
  /** Whether to show the overheal column (only for healing in effective mode) */
  showOverheal?: boolean
}

/**
 * Table showing breakdown by target.
 */
export function TargetTable({ 
  targets, 
  totalValue, 
  valueLabel = 'Value',
  showOverheal = false,
}: TargetTableProps) {
  const { hover, setHover, clearHover } = useBreakoutHover()
  
  if (!targets || targets.length === 0) {
    return <p className="text-xs p-2 text-muted-foreground">No target breakdown available</p>
  }

  // Sort by value descending
  const sorted = [...targets].sort((a, b) => b.value - a.value)
  
  // Check if any target has overheal data
  const hasOverhealData = showOverheal && sorted.some(t => t.overheal !== undefined && t.overheal > 0)

  // Column IDs for hover tracking (shared with AbilityTable where applicable)
  const COL = {
    TARGET: 'ability', // Use 'ability' so it syncs with the "Ability" column header
    VALUE: 'value',
    OVERHEAL: 'overheal',
    PERCENT: 'percent',
  }

  return (
    <div className="max-h-64 overflow-y-auto">
      <table className="w-full text-xs text-foreground">
        <thead className="sticky top-0 bg-popover z-10">
          <tr className="border-b border-border">
            <th className={cn("text-left py-1.5 px-2 font-medium", hover.columnId === COL.TARGET && "bg-primary/20")}>Target</th>
            <th className={cn("text-right py-1.5 px-2 font-medium", hover.columnId === COL.VALUE && "bg-primary/20")}>{valueLabel}</th>
            {hasOverhealData && (
              <th className={cn("text-right py-1.5 px-2 font-medium text-yellow-500/70", hover.columnId === COL.OVERHEAL && "bg-primary/20")}>Overheal</th>
            )}
            <th className={cn("text-right py-1.5 px-2 font-medium", hover.columnId === COL.PERCENT && "bg-primary/20")}>%</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((target) => {
            const valuePercent = totalValue > 0 ? (target.value / totalValue) * 100 : 0
            const rowId = target.targetName
            
            return (
              <tr key={target.targetId} className="border-b border-border/10">
                <HoverCell
                  rowId={rowId}
                  columnId={COL.TARGET}
                  hover={hover}
                  setHover={setHover}
                  clearHover={clearHover}
                  className="py-1 px-2 max-w-[150px] truncate"
                  title={target.targetName}
                >
                  {target.targetName}
                </HoverCell>
                <HoverCell
                  rowId={rowId}
                  columnId={COL.VALUE}
                  hover={hover}
                  setHover={setHover}
                  clearHover={clearHover}
                  className="text-right py-1 px-2 tabular-nums"
                >
                  {target.value.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                </HoverCell>
                {hasOverhealData && (
                  <HoverCell
                    rowId={rowId}
                    columnId={COL.OVERHEAL}
                    hover={hover}
                    setHover={setHover}
                    clearHover={clearHover}
                    className="text-right py-1 px-2 tabular-nums text-yellow-500/70"
                  >
                    {(() => {
                      const overhealVal = target.overheal ?? 0;
                      const totalForTarget = target.value + overhealVal;
                      const overhealPct = totalForTarget > 0 ? (overhealVal / totalForTarget) * 100 : 0;
                      return (
                        <>
                          {overhealVal.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                          <span className="text-yellow-500/50 ml-1">({overhealPct.toFixed(0)}%)</span>
                        </>
                      );
                    })()}
                  </HoverCell>
                )}
                <HoverCell
                  rowId={rowId}
                  columnId={COL.PERCENT}
                  hover={hover}
                  setHover={setHover}
                  clearHover={clearHover}
                  className="text-right py-1 px-2 tabular-nums text-muted-foreground"
                >
                  {valuePercent.toFixed(1)}%
                </HoverCell>
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
  /** Label for the target tab (defaults to "By Target") */
  targetTabLabel?: string
  /** Whether to show the Hits column (damage can miss, heals cannot) */
  showHits?: boolean
  /** Whether to show the overheal column (only for healing in effective mode) */
  showOverheal?: boolean
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
  targetTabLabel = 'By Target',
  showHits = true,
  showOverheal = false,
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
          showHits={showHits}
          showOverheal={showOverheal}
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
          {targetTabLabel}
        </button>
        {totalDisplay}
      </div>
      {activeTab === 'ability' ? (
        <AbilityTable
          abilities={abilities}
          totalValue={totalValue}
          valueLabel={valueLabel}
          showHits={showHits}
          showOverheal={showOverheal}
        />
      ) : (
        <TargetTable
          targets={targets}
          totalValue={totalValue}
          valueLabel={valueLabel}
          showOverheal={showOverheal}
        />
      )}
    </div>
  )
}
