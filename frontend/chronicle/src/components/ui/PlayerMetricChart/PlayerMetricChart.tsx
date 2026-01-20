import { useMemo } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/Tooltip/tooltip";
import { useMouse } from '@/hooks/useMouse';

export type ChartType = 'damage' | 'healing' | 'taken'

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
  const chartData = useMemo(() => {
    const sorted = [...computedData].sort((a, b) => b.value - a.value)
    return sorted.map((item, index) => ({
      ...item,
      rank: index + 1,
      color: `var(--class-${item.className.toLowerCase()})`,
    }))
  }, [computedData])

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
            showRank={type === 'damage' || type === 'healing' || type === 'taken'}
            type={type}
            suffix={perSecond ? '/s' : ''}
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
  type: ChartType
  suffix?: string
}

export function PlayerMetricRow({
  player,
  rowHeight,
  maximumValue,
  summedValue,
  showRank,
  type,
  suffix,
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
        hideWhenDetached>
        Hello
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