import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { PlayerMetricChart, type PlayerMetricChartData, type AbilityBreakdown, type RawAbilities } from './PlayerMetricChart'

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

// Mock ability breakdown data for different classes
const rogueAbilities: AbilityBreakdown[] = [
  { name: 'Backstab', totalDamage: 45000, hitCount: 82, critCount: 38, missCount: 5, dodgeCount: 2, immuneCount: 0, parryCount: 1, otherCount: 0 },
  { name: 'Sinister Strike', totalDamage: 32000, hitCount: 120, critCount: 45, missCount: 8, dodgeCount: 3, immuneCount: 0, parryCount: 2, otherCount: 0 },
  { name: 'Eviscerate', totalDamage: 28000, hitCount: 25, critCount: 12, missCount: 1, dodgeCount: 0, immuneCount: 0, parryCount: 0, otherCount: 0 },
  { name: 'Instant Poison', totalDamage: 15000, hitCount: 200, critCount: 0, missCount: 15, dodgeCount: 0, immuneCount: 0, parryCount: 0, otherCount: 5 },
  { name: 'Deadly Poison', totalDamage: 12000, hitCount: 45, critCount: 0, missCount: 3, dodgeCount: 0, immuneCount: 0, parryCount: 0, otherCount: 0 },
  { name: 'Blade Flurry', totalDamage: 8000, hitCount: 30, critCount: 8, missCount: 2, dodgeCount: 1, immuneCount: 0, parryCount: 0, otherCount: 0 },
]

const mageAbilities: AbilityBreakdown[] = [
  { name: 'Fireball', totalDamage: 52000, hitCount: 45, critCount: 22, missCount: 3, dodgeCount: 0, immuneCount: 0, parryCount: 0, otherCount: 2 },
  { name: 'Fire Blast', totalDamage: 18000, hitCount: 30, critCount: 15, missCount: 2, dodgeCount: 0, immuneCount: 0, parryCount: 0, otherCount: 0 },
  { name: 'Scorch', totalDamage: 15000, hitCount: 50, critCount: 18, missCount: 4, dodgeCount: 0, immuneCount: 0, parryCount: 0, otherCount: 1 },
  { name: 'Ignite', totalDamage: 12000, hitCount: 55, critCount: 0, missCount: 0, dodgeCount: 0, immuneCount: 0, parryCount: 0, otherCount: 0 },
  { name: 'Pyroblast', totalDamage: 8000, hitCount: 5, critCount: 3, missCount: 0, dodgeCount: 0, immuneCount: 0, parryCount: 0, otherCount: 0 },
]

const warriorAbilities: AbilityBreakdown[] = [
  { name: 'Bloodthirst', totalDamage: 38000, hitCount: 65, critCount: 28, missCount: 4, dodgeCount: 3, immuneCount: 0, parryCount: 2, otherCount: 0 },
  { name: 'Whirlwind', totalDamage: 25000, hitCount: 40, critCount: 15, missCount: 3, dodgeCount: 2, immuneCount: 0, parryCount: 1, otherCount: 0 },
  { name: 'Heroic Strike', totalDamage: 22000, hitCount: 55, critCount: 20, missCount: 5, dodgeCount: 2, immuneCount: 0, parryCount: 3, otherCount: 0 },
  { name: 'Execute', totalDamage: 18000, hitCount: 12, critCount: 8, missCount: 1, dodgeCount: 0, immuneCount: 0, parryCount: 0, otherCount: 0 },
  { name: 'Deep Wounds', totalDamage: 8000, hitCount: 63, critCount: 0, missCount: 0, dodgeCount: 0, immuneCount: 0, parryCount: 0, otherCount: 0 },
]

const warlockAbilities: AbilityBreakdown[] = [
  { name: 'Shadow Bolt', totalDamage: 48000, hitCount: 55, critCount: 25, missCount: 4, dodgeCount: 0, immuneCount: 0, parryCount: 0, otherCount: 2 },
  { name: 'Corruption', totalDamage: 22000, hitCount: 120, critCount: 0, missCount: 5, dodgeCount: 0, immuneCount: 0, parryCount: 0, otherCount: 0 },
  { name: 'Curse of Agony', totalDamage: 18000, hitCount: 90, critCount: 0, missCount: 3, dodgeCount: 0, immuneCount: 0, parryCount: 0, otherCount: 0 },
  { name: 'Immolate', totalDamage: 15000, hitCount: 45, critCount: 12, missCount: 2, dodgeCount: 0, immuneCount: 0, parryCount: 0, otherCount: 1 },
  { name: 'Siphon Life', totalDamage: 8000, hitCount: 60, critCount: 0, missCount: 2, dodgeCount: 0, immuneCount: 0, parryCount: 0, otherCount: 0 },
]

const hunterAbilities: AbilityBreakdown[] = [
  { name: 'Auto Shot', totalDamage: 35000, hitCount: 150, critCount: 45, missCount: 12, dodgeCount: 0, immuneCount: 0, parryCount: 0, otherCount: 3 },
  { name: 'Aimed Shot', totalDamage: 28000, hitCount: 25, critCount: 15, missCount: 2, dodgeCount: 0, immuneCount: 0, parryCount: 0, otherCount: 0 },
  { name: 'Multi-Shot', totalDamage: 18000, hitCount: 35, critCount: 12, missCount: 3, dodgeCount: 0, immuneCount: 0, parryCount: 0, otherCount: 0 },
  { name: 'Serpent Sting', totalDamage: 12000, hitCount: 80, critCount: 0, missCount: 4, dodgeCount: 0, immuneCount: 0, parryCount: 0, otherCount: 0 },
  { name: 'Arcane Shot', totalDamage: 8000, hitCount: 20, critCount: 8, missCount: 1, dodgeCount: 0, immuneCount: 0, parryCount: 0, otherCount: 0 },
]

// Mock data with ability breakdowns
const mockDataWithAbilities: PlayerMetricChartData[] = [
  { 
    playerID: 'player-1',
    playerName: 'Shadowmeld', 
    className: 'Rogue', 
    specialization: 'Combat', 
    value: 140000,
    abilityBreakdown: rogueAbilities,
  },
  { 
    playerID: 'player-2',
    playerName: 'Blazewing', 
    className: 'Mage', 
    specialization: 'Fire', 
    value: 105000,
    abilityBreakdown: mageAbilities,
  },
  { 
    playerID: 'player-3',
    playerName: 'Ragesmash', 
    className: 'Warrior', 
    specialization: 'Fury', 
    value: 111000,
    abilityBreakdown: warriorAbilities,
  },
  { 
    playerID: 'player-4',
    playerName: 'Afflicted', 
    className: 'Warlock', 
    specialization: 'Affliction', 
    value: 111000,
    abilityBreakdown: warlockAbilities,
  },
  { 
    playerID: 'player-5',
    playerName: 'Markshot', 
    className: 'Hunter', 
    specialization: 'Marksmanship', 
    value: 101000,
    abilityBreakdown: hunterAbilities,
  },
]

/**
 * Example with ability breakdown tooltips. Hover over a row to see the tooltip,
 * or click a row to pin the tooltip open.
 */
export const WithAbilityBreakdown: Story = {
  args: {
    data: mockDataWithAbilities,
    type: 'damage',
    duration_millis: STANDARD_DURATION_MILLIS,
    perSecond: false,
    style: {
      height: '400px',
      width: '600px',
    },
  },
  render: function Render(args) {
    const [perSecond, setPerSecond] = useState(args.perSecond ?? false)
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ fontSize: '14px', color: '#888' }}>
          <strong>Tip:</strong> Hover over a row to see ability breakdown. Click to pin the tooltip.
        </div>
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

// Helper to convert AbilityBreakdown[] to RawAbilities format
// Simulates API data structure: { [targetGUID]: { [abilityName]: Ability } }
function createRawAbilities(
  abilities: AbilityBreakdown[],
  targetGuids: string[]
): RawAbilities {
  const raw: RawAbilities = {}
  
  // Distribute abilities across targets
  for (const targetGuid of targetGuids) {
    raw[targetGuid] = {}
    for (const ability of abilities) {
      // Each target gets a portion of the total damage (simulating multi-target fights)
      const portion = 1 / targetGuids.length
      raw[targetGuid][ability.name] = {
        total_damage: Math.round(ability.totalDamage * portion),
        hit_count: Math.round(ability.hitCount * portion),
        crit_count: Math.round(ability.critCount * portion),
        miss_count: Math.round(ability.missCount * portion),
        dodge_count: Math.round(ability.dodgeCount * portion),
        immune_count: Math.round(ability.immuneCount * portion),
        parry_count: Math.round(ability.parryCount * portion),
        other_count: Math.round(ability.otherCount * portion),
      }
    }
  }
  
  return raw
}

// Enemy GUIDs for filtering demo
const ENEMY_GUIDS = {
  ragnaros: 'Creature-0-12345-409-0-11502-00001',
  majordomoExecutus: 'Creature-0-12345-409-0-12018-00002',
  baronGeddon: 'Creature-0-12345-409-0-12056-00003',
  garr: 'Creature-0-12345-409-0-12057-00004',
}

// Mock data with rawAbilities for filtering demo
const mockDataWithRawAbilities: PlayerMetricChartData[] = [
  { 
    playerID: 'player-1',
    playerName: 'Shadowmeld', 
    className: 'Rogue', 
    specialization: 'Combat', 
    value: 140000,
    rawAbilities: createRawAbilities(rogueAbilities, Object.values(ENEMY_GUIDS)),
  },
  { 
    playerID: 'player-2',
    playerName: 'Blazewing', 
    className: 'Mage', 
    specialization: 'Fire', 
    value: 105000,
    rawAbilities: createRawAbilities(mageAbilities, Object.values(ENEMY_GUIDS)),
  },
  { 
    playerID: 'player-3',
    playerName: 'Ragesmash', 
    className: 'Warrior', 
    specialization: 'Fury', 
    value: 111000,
    rawAbilities: createRawAbilities(warriorAbilities, Object.values(ENEMY_GUIDS)),
  },
  { 
    playerID: 'player-4',
    playerName: 'Afflicted', 
    className: 'Warlock', 
    specialization: 'Affliction', 
    value: 111000,
    rawAbilities: createRawAbilities(warlockAbilities, Object.values(ENEMY_GUIDS)),
  },
  { 
    playerID: 'player-5',
    playerName: 'Markshot', 
    className: 'Hunter', 
    specialization: 'Marksmanship', 
    value: 101000,
    rawAbilities: createRawAbilities(hunterAbilities, Object.values(ENEMY_GUIDS)),
  },
]

/**
 * Example demonstrating ability filtering by selected targets.
 * Select enemies to filter which damage is shown in the ability breakdown.
 * When no enemies are selected, all damage is shown.
 */
export const WithAbilityFiltering: Story = {
  args: {
    data: mockDataWithRawAbilities,
    type: 'damage',
    duration_millis: STANDARD_DURATION_MILLIS,
    perSecond: false,
    panelTitle: 'Damage Done',
    style: {
      height: '400px',
      width: '600px',
    },
  },
  render: function Render(args) {
    const [perSecond, setPerSecond] = useState(args.perSecond ?? false)
    const [selectedEnemies, setSelectedEnemies] = useState<Set<string>>(new Set())
    
    const toggleEnemy = (guid: string) => {
      setSelectedEnemies(prev => {
        const next = new Set(prev)
        if (next.has(guid)) {
          next.delete(guid)
        } else {
          next.add(guid)
        }
        return next
      })
    }
    
    const enemyNames: Record<string, string> = {
      [ENEMY_GUIDS.ragnaros]: 'Ragnaros',
      [ENEMY_GUIDS.majordomoExecutus]: 'Majordomo Executus',
      [ENEMY_GUIDS.baronGeddon]: 'Baron Geddon',
      [ENEMY_GUIDS.garr]: 'Garr',
    }
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ fontSize: '14px', color: '#888' }}>
          <strong>Tip:</strong> Select enemies below to filter which damage is shown in ability breakdowns.
          Hover or click a row to see the filtered breakdown.
        </div>
        
        {/* Enemy selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: '#1a1a1a', borderRadius: '8px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#888', textTransform: 'uppercase' }}>
            Filter by Enemy ({selectedEnemies.size === 0 ? 'All' : selectedEnemies.size + ' selected'})
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {Object.entries(ENEMY_GUIDS).map(([key, guid]) => (
              <button
                key={key}
                onClick={() => toggleEnemy(guid)}
                style={{
                  padding: '6px 12px',
                  fontSize: '13px',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  background: selectedEnemies.has(guid) ? '#c53030' : '#333',
                  color: selectedEnemies.has(guid) ? '#fff' : '#ccc',
                  transition: 'all 0.15s ease',
                }}
              >
                {enemyNames[guid]}
              </button>
            ))}
            {selectedEnemies.size > 0 && (
              <button
                onClick={() => setSelectedEnemies(new Set())}
                style={{
                  padding: '6px 12px',
                  fontSize: '13px',
                  borderRadius: '4px',
                  border: '1px solid #555',
                  cursor: 'pointer',
                  background: 'transparent',
                  color: '#888',
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
        
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
        
        <PlayerMetricChart 
          {...args} 
          perSecond={perSecond} 
          filterGuids={selectedEnemies.size > 0 ? selectedEnemies : undefined}
        />
      </div>
    )
  },
}
