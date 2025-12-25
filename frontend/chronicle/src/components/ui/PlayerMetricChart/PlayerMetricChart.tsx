import { useMemo } from 'react'

export interface PlayerMetricChartData {
  playerName: string
  className: string
  specialization: string
  value: number
}

interface PlayerMetricChartProps extends React.ComponentProps<"div"> {
  data: PlayerMetricChartData[]
  /**
   * Height of each row in pixels
   * @default 36
   */
  rowHeight?: number
  /**
   * Show rank numbers
   * @default true
   */
  showRank?: boolean

  metricSuffix?: string | React.ReactNode
}

export function PlayerMetricChart({
  data,
  rowHeight = 36,
  showRank = true,
  metricSuffix = <span style={{ fontSize: '0.9em' }}>/s</span>,
  className,
  style,
  ...divProps
}: PlayerMetricChartProps) {
  const summedValue = useMemo(() => {
    return data.reduce((sum, item) => sum + item.value, 0)
  }, [data])

  const maximumValue = useMemo(() => {
    return Math.max(...data.map((item) => item.value))
  }, [data])

  // Sort by value descending and calculate percentages
  const chartData = useMemo(() => {
    const sorted = [...data].sort((a, b) => b.value - a.value)
    return sorted.map((item, index) => ({
      ...item,
      rank: index + 1,
      color: `var(--color-class-${item.className.toLowerCase()})`,
    }))
  }, [data])

  return (
    <div
      style={{
        height: "400px",
        overflowY: 'auto',
        overflowX: 'hidden',
        borderRadius: '8px',
        backgroundColor: 'var(--background)',
        ...style,
      }}
      className={className}
      {...divProps}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '4px' }}>
        {chartData.map((player) => (
          <div
            key={player.playerName}
            style={{
              display: 'flex',
              alignItems: 'center',
              height: rowHeight,
              position: 'relative',
              // background: 'oklch(0.205 0 0)',
              borderRadius: '4px',
              overflow: 'hidden',
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
                background: player.color,
                opacity: 0.85,
                transition: 'width 0.3s ease',
              }}
            />

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
              {showRank && (
                <span
                  style={{
                    width: '32px',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'oklch(0.708 0 0)',
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
                  color: 'var(--color-primary-foreground)',//'oklch(0.985 0 0)',
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
                {player.value}{metricSuffix}
              </span>

              {/* Percentage */}
              <span
                style={{
                  width: '50px',
                  textAlign: 'right',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'oklch(0.708 0 0)',
                }}
              >
                {((player.value/summedValue)*100).toFixed(2)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}