import type { Meta, StoryObj } from '@storybook/react'
import { PlayerMetricChart, type PlayerMetricChartData } from './PlayerMetricChart'

const meta = {
  title: 'UI/PlayerMetricChart',
  component: PlayerMetricChart,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof PlayerMetricChart>

export default meta
type Story = StoryObj<typeof meta>

// Mock data representing a raid DPS parse
const mockRaidData: PlayerMetricChartData[] = [
  // { playerName: 'Arathís', className: 'Demon Hunter', specialization: 'Havoc', value: 2456789 },
  { playerName: 'Shadowmeld', className: 'Rogue', specialization: 'Subtlety', value: 2398654 },
  { playerName: 'Blazewing', className: 'Mage', specialization: 'Fire', value: 2287431 },
  { playerName: 'Moonfury', className: 'Druid', specialization: 'Balance', value: 2156234 },
  { playerName: 'Retribution', className: 'Paladin', specialization: 'Retribution', value: 2098765 },
  // { playerName: 'Frostblade', className: 'Death Knight', specialization: 'Frost', value: 2045678 },
  { playerName: 'Stormbringer', className: 'Shaman', specialization: 'Enhancement', value: 1987432 },
  { playerName: 'Markshot', className: 'Hunter', specialization: 'Marksmanship', value: 1934567 },
  { playerName: 'Afflicted', className: 'Warlock', specialization: 'Affliction', value: 1876543 },
  // { playerName: 'Windwalker', className: 'Monk', specialization: 'Windwalker', value: 1823456 },
  { playerName: 'Ragesmash', className: 'Warrior', specialization: 'Fury', value: 1789234 },
  // { playerName: 'Preservation', className: 'Evoker', specialization: 'Augmentation', value: 1645678 },
]

// Dense data set with many players
const denseMockData: PlayerMetricChartData[] = [
  ...mockRaidData,
  { playerName: 'Icyveins', className: 'Mage', specialization: 'Frost', value: 1598765 },
  // { playerName: 'Demonbane', className: 'Demon Hunter', specialization: 'Vengeance', value: 1523456 },
  { playerName: 'Thunderfist', className: 'Shaman', specialization: 'Elemental', value: 1487654 },
  { playerName: 'Wildshape', className: 'Druid', specialization: 'Feral', value: 1456789 },
  { playerName: 'Darkpact', className: 'Warlock', specialization: 'Demonology', value: 1398765 },
  { playerName: 'Holystrike', className: 'Priest', specialization: 'Shadow', value: 1345678 },
  { playerName: 'Beastmaster', className: 'Hunter', specialization: 'Beast Mastery', value: 1298765 },
  { playerName: 'Backstabber', className: 'Rogue', specialization: 'Assassination', value: 1256789 },
]

// Simple icon component (you'd use real WoW spec icons in production)
const SpecIcon = ({ className, spec }: { className: string; spec: string }) => {
  const getIconEmoji = (className: string) => {
    const iconMap: Record<string, string> = {
      'Death Knight': '⚔️',
      'Demon Hunter': '😈',
      'Druid': '🐻',
      'Evoker': '🐉',
      'Hunter': '🏹',
      'Mage': '✨',
      'Monk': '🥋',
      'Paladin': '⚡',
      'Priest': '✝️',
      'Rogue': '🗡️',
      'Shaman': '⚡',
      'Warlock': '💀',
      'Warrior': '🛡️',
    }
    return iconMap[className] || '⚔️'
  }

  return (
    <div
      style={{
        width: '24px',
        height: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '16px',
        borderRadius: '4px',
        background: 'oklch(0.269 0 0)',
      }}
      title={`${spec} ${className}`}
    >
      {getIconEmoji(className)}
    </div>
  )
}

export const Default: Story = {
  args: {
    data: mockRaidData,
  },
}

export const WithIcons: Story = {
  args: {
    data: mockRaidData,
    renderIcon: (data: PlayerMetricChartData) => <SpecIcon className={data.className} spec={data.specialization} />,
  },
}

export const DenseLayout: Story = {
  args: {
    data: denseMockData,
    barHeight: 32,
    renderIcon: (data: PlayerMetricChartData) => <SpecIcon className={data.className} spec={data.specialization} />,
  },
}

export const VeryDense: Story = {
  args: {
    data: denseMockData,
    barHeight: 24,
    showValues: false,
    renderIcon: (data: PlayerMetricChartData) => <SpecIcon className={data.className} spec={data.specialization} />,
  },
}

export const CustomHeight: Story = {
  args: {
    data: mockRaidData.slice(0, 5),
    height: 400,
    renderIcon: (data: PlayerMetricChartData) => <SpecIcon className={data.className} spec={data.specialization} />,
  },
}

export const WithoutValues: Story = {
  args: {
    data: mockRaidData,
    showValues: false,
    renderIcon: (data: PlayerMetricChartData) => <SpecIcon className={data.className} spec={data.specialization} />,
  },
}

export const SmallDataset: Story = {
  args: {
    data: mockRaidData.slice(0, 3),
    renderIcon: (data: PlayerMetricChartData) => <SpecIcon className={data.className} spec={data.specialization} />,
  },
}

export const CustomClassColors: Story = {
  args: {
    data: mockRaidData.slice(0, 6).map((item, index) => ({
      ...item,
      classColor: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7', '#a29bfe'][index],
    })),
    renderIcon: (data: PlayerMetricChartData) => <SpecIcon className={data.className} spec={data.specialization} />,
  },
}
