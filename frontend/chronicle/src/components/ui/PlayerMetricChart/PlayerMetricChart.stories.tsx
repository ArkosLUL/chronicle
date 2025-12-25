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
  { playerName: 'Shadowmeld', className: 'Rogue', specialization: 'Subtlety', value: 800.1 },
  { playerName: 'Blazewing', className: 'Mage', specialization: 'Fire', value: 512.2 },
  { playerName: 'Moonfury', className: 'Druid', specialization: 'Balance', value: 101.5 },
  { playerName: 'Retribution', className: 'Paladin', specialization: 'Retribution', value: 253.2 },
  { playerName: 'Stormbringer', className: 'Shaman', specialization: 'Enhancement', value: 450.1 },
  { playerName: 'Markshot', className: 'Hunter', specialization: 'Marksmanship', value: 482.2 },
  { playerName: 'Afflicted', className: 'Warlock', specialization: 'Affliction', value: 716.3 },
  { playerName: 'Ragesmash', className: 'Warrior', specialization: 'Fury', value: 412.3 },
]

// Dense data set with many players
const denseMockData: PlayerMetricChartData[] = [
  ...mockRaidData,
  { playerName: 'Icyveins', className: 'Mage', specialization: 'Frost', value: 11.11 },
  { playerName: 'Thunderfist', className: 'Shaman', specialization: 'Elemental', value: 1111.2 },
  { playerName: 'Wildshape', className: 'Druid', specialization: 'Feral', value: 1210.1 },
  { playerName: 'Darkpact', className: 'Warlock', specialization: 'Demonology', value: 148.2 },
  { playerName: 'Holystrike', className: 'Priest', specialization: 'Shadow', value: 210.2 },
  { playerName: 'Beastmaster', className: 'Hunter', specialization: 'Beast Mastery', value: 218.3 },
  { playerName: 'Backstabber', className: 'Rogue', specialization: 'Assassination', value: 410.2 },
  { playerName: "Saberslash", className: "Rogue", specialization: "Combat", value: 1339.9 },
  { playerName: "Sentur", className: "Warrior", specialization: "Fury", value: 1158.5 },
  { playerName: "Ragelisa", className: "Mage", specialization: "Fire", value: 1111.2 },
  { playerName: "Lonsell", className: "Warlock", specialization: "Destruction", value: 1009.2 },
  { playerName: "Katrix", className: "Hunter", specialization: "Marksmanship", value: 873.7 },
  { playerName: "Multifaker", className: "Rogue", specialization: "Assassination", value: 860.3 },
  { playerName: "Riczaocrl", className: "Mage", specialization: "Frost", value: 834.5 },
  { playerName: "Kryaa", className: "Priest", specialization: "Shadow", value: 743.6 },
  { playerName: "Blyte", className: "Warlock", specialization: "Affliction", value: 733.0 },
  { playerName: "Shovelrry", className: "Warrior", specialization: "Arms", value: 731.2 },
  { playerName: "Nevlen", className: "Hunter", specialization: "Beast Mastery", value: 629.4 },
  { playerName: "Owlboom", className: "Druid", specialization: "Balance", value: 587.8 },
  { playerName: "Corta", className: "Rogue", specialization: "Combat", value: 572.0 },
  { playerName: "Neziko", className: "Mage", specialization: "Fire", value: 537.1 },
  { playerName: "Blackwingz", className: "Hunter", specialization: "Survival", value: 328.5 },
  { playerName: "Bling", className: "Rogue", specialization: "Assassination", value: 33.3 },
  { playerName: "Lhian", className: "Paladin", specialization: "Retribution", value: 26.5 },
  { playerName: "Cigan", className: "Warrior", specialization: "Fury", value: 8.8 },
  { playerName: "Pcn", className: "Mage", specialization: "Arcane", value: 6.9 },
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
  },
}

export const CustomHeight: Story = {
  args: {
    data: mockRaidData.slice(0, 5),
    height: 400,
  },
}

export const WithoutValues: Story = {
  args: {
    data: mockRaidData,
  },
}

export const SmallDataset: Story = {
  args: {
    data: mockRaidData.slice(0, 3),
  },
}
