import { ResponsiveBar } from '@nivo/bar'
import { useMemo } from 'react'

export interface PlayerMetricChartData {
  playerName: string
  className: string
  specialization: string
  value: number
}

interface PlayerMetricChartProps {
  data: PlayerMetricChartData[]
  height?: number
  /**
   * Height of each bar in pixels. Lower values make the chart more dense.
   * @default 40
   */
  barHeight?: number
  /**
   * Whether to show the DPS value on the bars
   * @default true
   */
  showValues?: boolean
  /**
   * Custom icon renderer for class specialization
   */
  renderIcon?: (data: PlayerMetricChartData) => React.ReactNode
}

export function PlayerMetricChart({
    data,
    height,
    barHeight = 40,
    showValues = true,
    renderIcon,
  }: PlayerMetricChartProps) {
  // Transform data for Nivo
  const chartData = useMemo(
    () =>
      data.map((item) => ({
        ...item,
        id: item.playerName,
        color: `var(--color-class-${item.className.toLowerCase()})`,
        // color: getCssVar(`--class-${item.className.toLowerCase()}`),
      })),
    [data]
  )

  // Calculate chart height based on data length if not provided
  const chartHeight = height ?? Math.max(data.length * barHeight + 80, 300)

  // Get CSS custom properties for theme integration
  const styles = getComputedStyle(document.documentElement)
  const textColor = styles.getPropertyValue('--color-foreground').trim() || 'oklch(0.145 0 0)'
  const gridColor = styles.getPropertyValue('--color-border').trim() || 'oklch(0.922 0 0)'
  const mutedColor = styles.getPropertyValue('--color-muted-foreground').trim() || 'oklch(0.556 0 0)'

  return (
    <div style={{ height: chartHeight, width: '100%' }}>
      <ResponsiveBar
        data={chartData}
        keys={['value']}
        indexBy="playerName"
        layout="horizontal"
        margin={{ top: 20, right: 30, bottom: 40, left: 180 }}
        padding={0.2}
        valueScale={{ type: 'linear' }}
        indexScale={{ type: 'band', round: true }}
        colors={(bar) => bar.data.color}
        borderRadius={4}
        borderWidth={0}
        axisTop={null}
        axisRight={null}
        axisBottom={{
          tickSize: 5,
          tickPadding: 5,
          tickRotation: 0,
          legend: 'DPS',
          legendPosition: 'middle',
          legendOffset: 32,
          tickValues: 5,
          format: (value) => {
            if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
            if (value >= 1000) return `${(value / 1000).toFixed(0)}k`
            return value.toString()
          },
        }}
        axisLeft={{
          tickSize: 0,
          tickPadding: 12,
          tickRotation: 0,
          renderTick: (tick) => {
            const playerData = chartData.find((d) => d.playerName === tick.value)
            if (!playerData) return null

            return (
              <g transform={`translate(${tick.x - 10},${tick.y})`}>
                {/* Custom icon if provided */}
                {/*<img src={"/icons/class_mage.png"} />*/}

                <foreignObject x={-160} y={-12} width={24} height={24}>
                  <img src={`/icons/class_${playerData.className.toLowerCase()}.png`} />
                </foreignObject>
                {/* Player name */}
                <text
                  x={renderIcon ? -130 : -10}
                  y={0}
                  dy="0.35em"
                  textAnchor="end"
                  style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    fill: textColor,
                  }}
                >
                  {tick.value}
                </text>
                {/* Specialization */}
                <text
                  x={renderIcon ? -130 : -10}
                  y={0}
                  dy="1.5em"
                  textAnchor="end"
                  style={{
                    fontSize: '11px',
                    fill: mutedColor,
                  }}
                >
                  {playerData.specialization}
                </text>
              </g>
            )
          },
        }}
        enableGridY={false}
        enableGridX={true}
        gridXValues={5}
        enableLabel={showValues}
        label={(d) => {
          const value = d.value as number
          if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`
          if (value >= 1000) return `${(value / 1000).toFixed(1)}k`
          return value.toString()
        }}
        labelSkipWidth={12}
        labelSkipHeight={12}
        labelTextColor="oklch(0.985 0 0)"
        theme={{
          axis: {
            ticks: {
              text: {
                fill: mutedColor,
                fontSize: 12,
              },
            },
            legend: {
              text: {
                fill: textColor,
                fontSize: 13,
                fontWeight: 600,
              },
            },
          },
          grid: {
            line: {
              stroke: gridColor,
              strokeWidth: 1,
            },
          },
          tooltip: {
            container: {
              background: 'oklch(0.205 0 0)',
              color: 'oklch(0.985 0 0)',
              fontSize: '12px',
              borderRadius: '6px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
              padding: '8px 12px',
            },
          },
        }}
        tooltip={({ data }) => {
          const playerData = data as PlayerMetricChartData & { color: string }
          return (
            <div
              style={{
                background: 'oklch(0.205 0 0)',
                color: 'oklch(0.985 0 0)',
                padding: '10px 14px',
                borderRadius: '6px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                border: `2px solid ${playerData.color}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                {renderIcon && <div style={{ width: '20px', height: '20px' }}>{renderIcon(playerData)}</div>}
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px' }}>{playerData.playerName}</div>
                  <div style={{ fontSize: '11px', color: 'oklch(0.708 0 0)' }}>
                    {playerData.specialization} {playerData.className}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '4px' }}>
                {playerData.value.toLocaleString()} DPS
              </div>
            </div>
          )
        }}
        animate={true}
        motionConfig="gentle"
      />
    </div>
  )
}
