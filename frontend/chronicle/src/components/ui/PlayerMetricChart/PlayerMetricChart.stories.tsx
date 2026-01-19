import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { PlayerMetricChart, type PlayerMetricChartData } from './PlayerMetricChart'

const meta = {
  title: 'UI/PlayerMetricChart',
  component: PlayerMetricChart,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    perSecond: {
      control: 'boolean',
      description: 'Show values as per-second (DPS/HPS)',
    },
    duration_millis: {
      control: 'number',
      description: 'Duration in milliseconds (used when perSecond is true)',
    },
  },
} satisfies Meta<typeof PlayerMetricChart>

export default meta
type Story = StoryObj<typeof meta>

// Standard fight duration: 3 minutes 30 seconds
const STANDARD_DURATION_MILLIS = 3.5 * 60 * 1000 // 210,000ms

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
].map((item, index) => ({
  ...item,
  playerID: `player-${index + 1}`,
}))

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
].map((item, index) => ({
  ...item,
  playerID: `player-${index + 1}`,
}))

const mockRaidHealingData: PlayerMetricChartData[] = [
  { playerName: 'Moonfury', className: 'Druid', specialization: 'Restoration', value: 360.5, stackedValue: 52.0 },
  { playerName: 'Retribution', className: 'Paladin', specialization: 'Holy', value: 252.2, stackedValue: 89.0 },
  { playerName: 'Stormbringer', className: 'Shaman', specialization: 'Restoration', value: 451.1, stackedValue: 100.5 },
  { playerName: 'Repel', className: 'Priest', specialization: 'Holy', value: 299.3, stackedValue: 120.5 },
  { playerName: 'Darkman', className: 'Priest', specialization: 'Shadow', value: 45.3, stackedValue: 151.2 },
].map((item, index) => ({
  ...item,
  playerID: `player-${index + 1}`,
}))


export const Default: Story = {
  args: {
    data: mockRaidData,
    type: 'damage',
  },
}

export const Dense: Story = {
  args: {
    ...Default.args,
    data: denseMockData,
  },
}

export const CustomDimensions: Story = {
  args: {
    ...Default.args,
    data: denseMockData,
    style: {
      height: '300px',
      width: '450px',
    }
  },
}

export const NoRank: Story = {
  args: {
    ...Default.args,
    data: denseMockData,
    style: {
      height: '300px',
      width: '450px',
    },
  },
}

export const Healing: Story = {
  args: {
    ...Default.args,
    data: mockRaidHealingData,
    type: 'healing',
    style: {
      height: '300px',
      width: '450px',
    },
  },
}

// Interactive story with per-second toggle
export const WithPerSecondToggle: Story = {
  args: {
    data: denseMockData,
    type: 'damage',
    duration_millis: STANDARD_DURATION_MILLIS,
    perSecond: false,
  },
  render: function Render(args) {
    const [perSecond, setPerSecond] = useState(args.perSecond ?? false)
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={perSecond}
            onChange={(e) => setPerSecond(e.target.checked)}
            style={{ width: '18px', height: '18px' }}
          />
          <span style={{ fontSize: '14px', fontWeight: 500 }}>
            Show as {perSecond ? 'Total Damage' : 'DPS (per second)'}
          </span>
          <span style={{ fontSize: '12px', color: '#888' }}>
            (Duration: {(args.duration_millis! / 1000).toFixed(1)}s)
          </span>
        </label>
        <PlayerMetricChart {...args} perSecond={perSecond} />
      </div>
    )
  },
}

export const HealingWithPerSecondToggle: Story = {
  args: {
    data: mockRaidHealingData,
    type: 'healing',
    duration_millis: STANDARD_DURATION_MILLIS,
    perSecond: false,
    style: {
      height: '300px',
      width: '450px',
    },
  },
  render: function Render(args) {
    const [perSecond, setPerSecond] = useState(args.perSecond ?? false)
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={perSecond}
            onChange={(e) => setPerSecond(e.target.checked)}
            style={{ width: '18px', height: '18px' }}
          />
          <span style={{ fontSize: '14px', fontWeight: 500 }}>
            Show as {perSecond ? 'Total Healing' : 'HPS (per second)'}
          </span>
          <span style={{ fontSize: '12px', color: '#888' }}>
            (Duration: {(args.duration_millis! / 1000).toFixed(1)}s)
          </span>
        </label>
        <PlayerMetricChart {...args} perSecond={perSecond} />
      </div>
    )
  },
}
