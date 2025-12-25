import { useMemo } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/Tooltip/tooltip";
import { useMouse } from '@/hooks/useMouse';

export interface PlayerMetricChartData {
  playerID: string
  playerName: string
  className: string
  specialization: string
  value: number
  // stackValue is used for over healing.
  stackedValue?: number
  // TODO: Add a function that returns the tooltip for a given row.
  // It should have a table breakdown of the data.
  // tooltipFunction?: (PlayerMetricChartData)
}

interface PlayerMetricChartProps extends React.ComponentProps<"div"> {
  data: PlayerMetricChartData[]
  /**
   * Height of each row in pixels
   * @default 36
   */
  rowHeight?: number
  type: 'damage' | 'healing'
}

export function PlayerMetricChart({
  data,
  rowHeight = 30,
  className,
  style,
  type,
  ...divProps
}: PlayerMetricChartProps) {
  const summedValue = useMemo(() => {
    return data.reduce((sum, item) => sum + item.value, 0)
  }, [data])

  const maximumValue = useMemo(() => {
    return Math.max(...data.map((item) => item.value + (item.stackedValue || 0)))
  }, [data])

  // Sort by value descending and calculate percentages
  const chartData = useMemo(() => {
    const sorted = [...data].sort((a, b) => b.value - a.value)
    return sorted.map((item, index) => ({
      ...item,
      rank: index + 1,
      color: `var(--class-${item.className.toLowerCase()})`,
    }))
  }, [data])

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
            player={player} 
            rowHeight={rowHeight}
            maximumValue={maximumValue}
            summedValue={summedValue}
            showRank={type === 'damage' || type === 'healing'}
          />
        })}
      </div>
    </div>
  )
}

export interface PlayerMetricRowProps {
  player: PlayerMetricChartData & {color:string, rank:number}
  rowHeight: number
  maximumValue: number
  summedValue: number
  showRank: boolean
}

export function PlayerMetricRow({
  player,
  rowHeight,
  maximumValue,
  summedValue,
  showRank,
}: PlayerMetricRowProps) {
  const { ref, x, y } = useMouse<HTMLDivElement>();
  return (
  <TooltipProvider key={player.playerID + player.playerName}>
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <div
          ref={ref}
          style={{
            display: 'flex',
            alignItems: 'center',
            height: rowHeight,
            position: 'relative',
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
            color: 'var(--class-foreground)',//'oklch(0.985 0 0)',
          }}
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
                // Fallback to class icon if spec icon not found
                e.currentTarget.src = `/icons/class_${player.className.toLowerCase()}.png`
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
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'oklch(0.985 0 0)',
                background: 'oklch(0.205 0 0 / 0.7)',
                padding: '2px 8px',
                borderRadius: '4px',
                marginRight: '12px',
              }}
            >
              {player.value}/s
            </span>

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
        hideWhenDetached>
        Hello
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
)
}