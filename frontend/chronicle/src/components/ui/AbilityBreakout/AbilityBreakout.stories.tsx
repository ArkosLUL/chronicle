import type { Meta, StoryObj } from '@storybook/react-vite'
import { AbilityBreakout, AbilityTable, TargetTable, type AbilityData, type TargetData } from './AbilityBreakout'

const meta = {
  title: 'UI/AbilityBreakout',
  component: AbilityBreakout,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    valueLabel: {
      control: 'text',
      description: 'Label for the value column',
    },
    pinned: {
      control: 'boolean',
      description: 'Whether breakout is pinned',
    },
  },
} satisfies Meta<typeof AbilityBreakout>

// Wrapper to constrain width like a tooltip
const TooltipWidth = ({ children }: { children: React.ReactNode }) => (
  <div style={{ maxWidth: 380 }}>{children}</div>
)

export default meta
type Story = StoryObj<typeof meta>

// ============================================================================
// Mock Data
// ============================================================================

const mockRogueAbilities: AbilityData[] = [
  { name: 'Backstab', value: 45000, hitCount: 82, critCount: 38, missCount: 5, dodgeCount: 2, parryCount: 1 },
  { name: 'Sinister Strike', value: 32000, hitCount: 120, critCount: 45, missCount: 8, dodgeCount: 3, parryCount: 2 },
  { name: 'Eviscerate', value: 28000, hitCount: 25, critCount: 12, missCount: 1, dodgeCount: 0, parryCount: 0 },
  { name: 'Instant Poison', value: 15000, hitCount: 200, critCount: 0, missCount: 15, dodgeCount: 0, parryCount: 0 },
  { name: 'Deadly Poison', value: 12000, hitCount: 45, critCount: 0, missCount: 3, dodgeCount: 0, parryCount: 0 },
  { name: 'Blade Flurry', value: 8000, hitCount: 30, critCount: 8, missCount: 2, dodgeCount: 1, parryCount: 0 },
]

const mockMageAbilities: AbilityData[] = [
  { name: 'Fireball', value: 52000, hitCount: 45, critCount: 22, missCount: 3 },
  { name: 'Fire Blast', value: 18000, hitCount: 30, critCount: 15, missCount: 2 },
  { name: 'Scorch', value: 15000, hitCount: 50, critCount: 18, missCount: 4 },
  { name: 'Ignite', value: 12000, hitCount: 55, critCount: 0, missCount: 0 },
  { name: 'Pyroblast', value: 8000, hitCount: 5, critCount: 3, missCount: 0 },
]

const mockHealerAbilities: AbilityData[] = [
  { name: 'Greater Heal', value: 85000, hitCount: 45, critCount: 12 },
  { name: 'Flash Heal', value: 42000, hitCount: 80, critCount: 18 },
  { name: 'Renew', value: 35000, hitCount: 120, critCount: 0 },
  { name: 'Prayer of Healing', value: 28000, hitCount: 15, critCount: 4 },
  { name: 'Circle of Healing', value: 18000, hitCount: 30, critCount: 6 },
]

const mockTargets: TargetData[] = [
  { targetId: 'boss-1', targetName: 'Ragnaros', value: 85000, hitCount: 180, critCount: 52 },
  { targetId: 'add-1', targetName: 'Son of Flame', value: 32000, hitCount: 65, critCount: 18 },
  { targetId: 'add-2', targetName: 'Son of Flame', value: 28000, hitCount: 58, critCount: 15 },
  { targetId: 'add-3', targetName: 'Lava Spawn', value: 12000, hitCount: 25, critCount: 8 },
]

const mockHealingTargets: TargetData[] = [
  { targetId: 'player-1', targetName: 'Tanky McTankface', value: 95000, hitCount: 120, critCount: 28 },
  { targetId: 'player-2', targetName: 'Stabsworth', value: 45000, hitCount: 65, critCount: 15 },
  { targetId: 'player-3', targetName: 'Pyromancer', value: 38000, hitCount: 52, critCount: 12 },
  { targetId: 'player-4', targetName: 'Arrowflight', value: 22000, hitCount: 30, critCount: 8 },
  { targetId: 'player-5', targetName: 'Shadowweaver', value: 8000, hitCount: 12, critCount: 3 },
]

const totalRogueDamage = mockRogueAbilities.reduce((sum, a) => sum + a.value, 0)
const totalMageDamage = mockMageAbilities.reduce((sum, a) => sum + a.value, 0)
const totalHealing = mockHealerAbilities.reduce((sum, a) => sum + a.value, 0)

// ============================================================================
// Stories
// ============================================================================

/**
 * Default breakout with abilities only (no tabs).
 */
export const Default: Story = {
  args: {
    abilities: mockRogueAbilities,
    totalValue: totalRogueDamage,
    valueLabel: 'Damage',
  },
  render: (args) => (
    <TooltipWidth>
      <AbilityBreakout {...args} />
    </TooltipWidth>
  ),
}

/**
 * Breakout with both abilities and targets (tabbed view).
 */
export const WithTargets: Story = {
  args: {
    abilities: mockMageAbilities,
    targets: mockTargets,
    totalValue: totalMageDamage,
    valueLabel: 'Damage',
  },
  render: (args) => (
    <TooltipWidth>
      <AbilityBreakout {...args} />
    </TooltipWidth>
  ),
}

/**
 * Healing breakout example.
 */
export const HealingBreakout: Story = {
  args: {
    abilities: mockHealerAbilities,
    targets: mockHealingTargets,
    totalValue: totalHealing,
    valueLabel: 'Healing',
  },
  render: (args) => (
    <TooltipWidth>
      <AbilityBreakout {...args} />
    </TooltipWidth>
  ),
}

/**
 * Per-second values (DPS/HPS).
 */
export const PerSecondValues: Story = {
  args: {
    abilities: mockMageAbilities.map(a => ({ ...a, value: Math.round(a.value / 210) })),
    targets: mockTargets.map(t => ({ ...t, value: Math.round(t.value / 210) })),
    totalValue: Math.round(totalMageDamage / 210),
    valueLabel: 'DPS',
  },
  render: (args) => (
    <TooltipWidth>
      <AbilityBreakout {...args} />
    </TooltipWidth>
  ),
}

/**
 * Empty abilities list.
 */
export const EmptyAbilities: Story = {
  args: {
    abilities: [],
    totalValue: 0,
    valueLabel: 'Damage',
  },
  render: (args) => (
    <TooltipWidth>
      <AbilityBreakout {...args} />
    </TooltipWidth>
  ),
}

/**
 * Many abilities (scrolling).
 */
export const ManyAbilities: Story = {
  args: {
    abilities: [
      ...mockRogueAbilities,
      { name: 'Rupture', value: 7500, hitCount: 40, critCount: 0 },
      { name: 'Slice and Dice', value: 0, hitCount: 25, critCount: 0 },
      { name: 'Garrote', value: 5500, hitCount: 8, critCount: 0 },
      { name: 'Ambush', value: 4200, hitCount: 3, critCount: 2 },
      { name: 'Hemorrhage', value: 3800, hitCount: 15, critCount: 5 },
      { name: 'Ghostly Strike', value: 2900, hitCount: 8, critCount: 3 },
      { name: 'Riposte', value: 1500, hitCount: 4, critCount: 1 },
      { name: 'Kick', value: 800, hitCount: 6, critCount: 0 },
      { name: 'Gouge', value: 400, hitCount: 3, critCount: 0 },
    ],
    totalValue: totalRogueDamage + 26600,
    valueLabel: 'Damage',
  },
  render: (args) => (
    <TooltipWidth>
      <AbilityBreakout {...args} />
    </TooltipWidth>
  ),
}

/**
 * Pinned state (for potential future styling).
 */
export const Pinned: Story = {
  args: {
    abilities: mockMageAbilities,
    targets: mockTargets,
    totalValue: totalMageDamage,
    valueLabel: 'Damage',
    pinned: true,
  },
  render: (args) => (
    <TooltipWidth>
      <div className="border rounded-md p-4">
        <div className="text-muted-foreground text-xs mb-2">Pinned breakout</div>
        <AbilityBreakout {...args} />
      </div>
    </TooltipWidth>
  ),
}

// ============================================================================
// Individual Component Stories
// ============================================================================

export const AbilityTableOnly: StoryObj<typeof AbilityTable> = {
  render: () => (
    <TooltipWidth>
      <AbilityTable
        abilities={mockRogueAbilities}
        totalValue={totalRogueDamage}
        valueLabel="Damage"
      />
    </TooltipWidth>
  ),
}

export const TargetTableOnly: StoryObj<typeof TargetTable> = {
  render: () => (
    <TooltipWidth>
      <TargetTable
        targets={mockTargets}
        totalValue={totalRogueDamage}
        valueLabel="Damage"
      />
    </TooltipWidth>
  ),
}
