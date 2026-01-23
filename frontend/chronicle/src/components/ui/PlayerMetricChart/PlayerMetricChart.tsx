import { useMemo, useState } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/Tooltip/tooltip";
import { useMouse } from '@/hooks/useMouse';
import { cn } from '@/lib/utils';

export type ChartType = 'damage' | 'healing' | 'taken'

// Ability breakdown for tooltip display
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

export interface PlayerMetricChartData {
  playerID: string
  playerName: string
  className: string
  specialization: string
  value: number
  // stackValue is used for over healing.
  stackedValue?: number
  // dimmed reduces visual prominence (used for filtering)
  dimmed?: boolean
  // Ability breakdown for tooltip
  abilityBreakdown?: AbilityBreakdown[]
}

interface PlayerMetricChartProps extends React.ComponentProps<"div"> {
  data: PlayerMetricChartData[]
  /**
   * Height of each row in pixels
   * @default 36
   */
  rowHeight?: number
  type: ChartType
  // If perSecond is true, value is DPS/HPS
  perSecond?: boolean
  duration_millis?: number
}

export function PlayerMetricChart({
  data,
  rowHeight = 30,
  className,
  style,
  type,
  perSecond,
  duration_millis,
  ...divProps
}: PlayerMetricChartProps) {
  // Track which row has a pinned tooltip
  const [pinnedPlayerId, setPinnedPlayerId] = useState<string | null>(null)

  const computedData = useMemo(() => {
    return data.map((item) => ({
      ...item,
      value: perSecond ? (item.value / duration_millis!) * 1000 : item.value,
      stackedValue: item.stackedValue ? (perSecond ? (item.stackedValue / duration_millis!) * 1000 : item.stackedValue) : undefined,
    }))
  }, [data, perSecond, duration_millis])


  const summedValue = useMemo(() => {
    return computedData.reduce((sum, item) => sum + item.value, 0)
  }, [computedData])

  const maximumValue = useMemo(() => {
    return Math.max(...computedData.map((item) => item.value + (item.stackedValue || 0)))
  }, [computedData])

  // Sort by value descending and calculate percentages
  // Dimmed items are sorted to the bottom
  const chartData = useMemo(() => {
    const sorted = [...computedData].sort((a, b) => {
      // Non-dimmed items come first
      if (a.dimmed !== b.dimmed) {
        return a.dimmed ? 1 : -1;
      }
      return b.value - a.value;
    })
    return sorted.map((item, index) => ({
      ...item,
      rank: index + 1,
      color: `var(--class-${item.className.toLowerCase()})`,
    }))
  }, [computedData])

  const handleRowClick = (playerId: string) => {
    setPinnedPlayerId(prev => prev === playerId ? null : playerId)
  }

  return (
    <div
      style={{
        height: "400px", // Default
        overflowY: 'auto',
        overflowX: 'hidden',
        ...style,
      }}
      className={className}
      {...divProps}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '4px' }}>
        {chartData.map((player) => {
          return <PlayerMetricRow 
            key={player.playerID}
            player={player} 
            rowHeight={rowHeight}
            maximumValue={maximumValue}
            summedValue={summedValue}
            showRank={type === 'damage' || type === 'healing' || type === 'taken'}
            type={type}
            suffix={perSecond ? '/s' : ''}
            isPinned={pinnedPlayerId === player.playerID}
            onTogglePin={() => handleRowClick(player.playerID)}
          />
        })}
      </div>
    </div>
  )
}

export interface PlayerMetricRowProps {
  player: PlayerMetricChartData & {color:string, rank:number, dimmed?: boolean}
  rowHeight: number
  maximumValue: number
  summedValue: number
  showRank: boolean
  type: ChartType
  suffix?: string
  isPinned?: boolean
  onTogglePin?: () => void
}

// Format number compactly
function formatCompactNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`
  }
  return value.toFixed(0)
}

// Ability breakdown table component
function AbilityBreakdownTable({ abilities, totalValue }: { abilities: AbilityBreakdown[], totalValue: number }) {
  if (!abilities || abilities.length === 0) {
    return <p className="text-xs text-muted-foreground p-2">No ability breakdown available</p>
  }

  // Sort by damage descending
  const sorted = [...abilities].sort((a, b) => b.totalDamage - a.totalDamage)

  return (
    <div className="max-h-64 overflow-y-auto">
      <table className="w-full text-xs text-foreground">
        <thead className="sticky top-0 bg-popover">
          <tr className="border-b border-border">
            <th className="text-left py-1.5 px-2 font-medium">Ability</th>
            <th className="text-right py-1.5 px-2 font-medium">Damage</th>
            <th className="text-right py-1.5 px-2 font-medium">%</th>
            <th className="text-right py-1.5 px-2 font-medium">Count</th>
            <th className="text-right py-1.5 px-2 font-medium">Crit%</th>
            {/* <th className="text-right py-1.5 px-2 font-medium">Miss</th>
            <th className="text-right py-1.5 px-2 font-medium">Dodge</th>
            <th className="text-right py-1.5 px-2 font-medium">Parry</th>
            <th className="text-right py-1.5 px-2 font-medium">Other</th> */}
          </tr>
        </thead>
        <tbody className="text-background">
          {sorted.map((ability) => {
            const totalHits = ability.hitCount + ability.critCount
            const critPercent = totalHits > 0 ? (ability.critCount / totalHits) * 100 : 0
            const damagePercent = totalValue > 0 ? (ability.totalDamage / totalValue) * 100 : 0
            
            return (
              <tr key={ability.name} className="border-b border-border/50 hover:bg-muted/50">
                <td className="py-1 px-2 max-w-[150px] truncate" title={ability.name}>
                  {ability.name}
                </td>
                <td className="text-right py-1 px-2 tabular-nums">
                  {formatCompactNumber(ability.totalDamage)}
                </td>
                <td className="text-right py-1 px-2 tabular-nums text-muted-foreground">
                  {damagePercent.toFixed(1)}%
                </td>
                <td className="text-right py-1 px-2 tabular-nums">
                  {totalHits}
                </td>
                <td className="text-right py-1 px-2 tabular-nums">
                  {critPercent.toFixed(0)}%
                </td>
                {/* <td className="text-right py-1 px-2 tabular-nums text-muted-foreground">
                  {ability.missCount > 0 ? ability.missCount : '-'}
                </td>
                <td className="text-right py-1 px-2 tabular-nums text-muted-foreground">
                  {ability.dodgeCount > 0 ? ability.dodgeCount : '-'}
                </td>
                <td className="text-right py-1 px-2 tabular-nums text-muted-foreground">
                  {ability.parryCount > 0 ? ability.parryCount : '-'}
                </td>
                <td className="text-right py-1 px-2 tabular-nums text-muted-foreground">
                  {ability.otherCount > 0 ? ability.otherCount : '-'}
                </td> */}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function PlayerMetricRow({
  player,
  rowHeight,
  maximumValue,
  summedValue,
  showRank,
  type,
  suffix,
  isPinned = false,
  onTogglePin,
}: PlayerMetricRowProps) {
  const { ref, x, y } = useMouse<HTMLDivElement>();
  const isDimmed = player.dimmed ?? false;
  
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    onTogglePin?.()
  }

  return (
  <TooltipProvider key={player.playerID + player.playerName}>
    <Tooltip delayDuration={0} open={isPinned ? true : undefined}>
      <TooltipTrigger asChild>
        <div
          ref={ref}
          onClick={handleClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            height: rowHeight,
            position: 'relative',
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
            color: 'var(--class-foreground)',//'oklch(0.985 0 0)',
            opacity: isDimmed ? 0.35 : 1,
            transition: 'opacity 0.2s ease',
            cursor: 'pointer',
          }}
          className={cn(isPinned && "ring-2 ring-primary ring-inset")}
        >
          {/* Colored bar background */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${(player.value / maximumValue) * 100}%`,
              background: `linear-gradient(to right, oklch(0 0 0 / 0.3), oklch(0 0 0 / 0.15)), ${player.color}`,
              opacity: 0.85,
              transition: 'width 0.3s ease',
            }}
          />
          
          {/* Stacked value */}
          {player.stackedValue && (
          <div
            style={{
              position: 'absolute',
              left: `${(player.value / maximumValue) * 100}%`,
              top: 0,
              bottom: 0,
              width: `${(player.stackedValue / maximumValue) * 100}%`,
              background: `${player.color}`,
              opacity: 0.3,
              transition: 'width 0.3s ease',
            }}
          />)
          }

          {/* Content overlay */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              padding: '0 12px',
              zIndex: 1,
            }}
          >

          {/* Rank */}
          {showRank && (<span
              style={{
                width: '32px',
                fontSize: '13px',
                fontWeight: 500,
              }}
            >
              #{player.rank}
            </span>
            )}

            {/* Icon */}
            <img
              src={`/icons/spec_${player.className.toLowerCase()}_${player.specialization.toLowerCase().replace(/\s+/g, '')}.png`}
              alt={player.specialization}
              style={{
                width: '20px',
                height: '20px',
                marginRight: '8px',
                borderRadius: '2px',
              }}
              onError={(e) => {
                // Fallback to class icon if spec icon not found, then to unknown
                const target = e.currentTarget;
                const classIcon = `/icons/class_${player.className.toLowerCase()}.png`;
                const unknownIcon = '/icons/class_unknown.png';
                if (target.src.endsWith(unknownIcon)) {
                  // Already at fallback, hide the image
                  target.style.display = 'none';
                } else if (target.src.includes('/icons/class_')) {
                  // Class icon failed, try unknown
                  target.src = unknownIcon;
                } else {
                  // Spec icon failed, try class icon
                  target.src = classIcon;
                }
              }}
            />

            {/* Spec name */}
            <span
              style={{
                flex: 1,
                fontSize: '13px',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {player.playerName}
            </span>

            {/* DPS value */}
            {formatValue(type, player, suffix)}

            {/* {player.stackedValue && (<span
              style={{
                minWidth: '5em',
                fontSize: '12px',
                fontWeight: 600,
                color: 'oklch(0.985 0 0)',
                background: 'oklch(0.205 0 0 / 0.7)',
                padding: '2px 8px',
                borderRadius: '4px',
                marginRight: '12px',
              }}
              >
                {formatValue(type, player)}
              </span>
            )} */}


            {/* Percentage */}
            <span
              style={{
                width: '50px',
                textAlign: 'right',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--class-muted-foreground)',
              }}
            >
              {((player.value/summedValue)*100).toFixed(2)}%
            </span>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent 
        align="start"
        alignOffset={x}
        sideOffset={-y + 10}
        hideWhenDetached
        className="p-0 min-w-[340px]"
        onPointerDownOutside={(e) => {
          // Prevent closing when clicking inside the tooltip
          if (isPinned) {
            e.preventDefault()
          }
        }}
      >
        <div className="p-3 border-b border-border">
          <div className="flex items-center gap-2">
            <span 
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: player.color }}
            />
            <span className="font-medium">{player.playerName}</span>
            <span className="text-muted-foreground text-xs ml-auto">
              {player.className}
            </span>
          </div>
          {/* <div className="flex items-center gap-4 mt-1 text-sm">
            <span>Total: <strong>{formatCompactNumber(player.value)}</strong>{suffix}</span>
            <span className="text-muted-foreground">
              {((player.value/summedValue)*100).toFixed(1)}% of total
            </span>
          </div> */}
          {isPinned && (
            <p className="text-xs text-muted-foreground mt-2">
              Click row again to unpin
            </p>
          )}
        </div>
        <AbilityBreakdownTable 
          abilities={player.abilityBreakdown ?? []} 
          totalValue={player.value}
        />
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
)
}

function formatValue(type: ChartType, player: PlayerMetricChartData, suffix?: string) {
  const styles = {
    fontSize: '0.7em',
    fontWeight: 600,
    color: 'oklch(0.985 0 0)',
    background: 'oklch(0.205 0 0 / 0.7)',
    padding: '2px 8px',
    borderRadius: '4px',
    marginRight: '12px',
  }

  switch (type) {
    // case 'healing':
      // return <span
      //   style={{
      //     ...styles
      //   }}
      //   >
      //   {player.value.toFixed(1)}/s &nbsp;
      //   <span
      //   style={{color: 'var(--class-muted-foreground)', fontSize: '0.8em'}}>
      //   {`(+${player.stackedValue?.toFixed(1) ?? 0}/s)`}
      //   </span>
      // </span>
    // case 'damage':
    default:
      return (<span
        style={{
          ...styles
        }}
      >
        {player.value.toFixed(1)}{suffix}
      </span>)
  }
}