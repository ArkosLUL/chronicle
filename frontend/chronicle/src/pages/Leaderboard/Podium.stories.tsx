import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { ParticleEffect, INSTANCE_THEMES, DEFAULT_THEME } from "./Podium"
import type { ParticleStyle } from "./Podium"

const ALL_STYLES: ParticleStyle[] = ["embers", "spores", "sand", "smoke", "voodoo", "arcane", "frost"]

// Wrapper that renders a card-sized box with the particle effect
function ParticleCard({ instanceName, label }: { instanceName: string; label: string }) {
  const theme = INSTANCE_THEMES[instanceName] ?? DEFAULT_THEME
  return (
    <div
      className="relative overflow-hidden w-72 min-h-[260px] rounded-xl border flex items-end justify-center p-6"
      style={{
        borderColor: theme.border,
        boxShadow: `0 4px 24px ${theme.glow}, 0 8px 48px ${theme.glow}, 0 0 100px ${theme.glow}`,
        backgroundImage: `linear-gradient(to bottom, ${theme.glow}, transparent)`,
        backgroundColor: "#1a1a2e",
      }}
    >
      <ParticleEffect instanceName={instanceName} />
      <div className="relative z-10 text-center">
        <div className="text-lg font-bold text-white">{label}</div>
        <div className="text-xs text-white/50 mt-1">{theme.particleStyle}</div>
      </div>
    </div>
  )
}

// Grid showing all instance themes
function AllParticles() {
  const instances = Object.keys(INSTANCE_THEMES)
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 24, padding: 24 }}>
      {instances.map((name) => (
        <ParticleCard key={name} instanceName={name} label={name} />
      ))}
      <ParticleCard instanceName="__default__" label="Default (fallback)" />
    </div>
  )
}

// Single style preview for controls
function SingleParticle({ instanceName }: { instanceName: string }) {
  return (
    <div style={{ padding: 40 }}>
      <ParticleCard instanceName={instanceName} label={instanceName} />
    </div>
  )
}

const meta = {
  title: "Leaderboard/ParticleEffects",
  component: SingleParticle,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    backgrounds: { default: "dark", values: [{ name: "dark", value: "#0f0f17" }] },
  },
  argTypes: {
    instanceName: {
      control: "select",
      options: [...Object.keys(INSTANCE_THEMES), "__default__"],
      description: "Instance to preview particle style",
    },
  },
} satisfies Meta<typeof SingleParticle>

export default meta
type Story = StoryObj<typeof meta>

export const MoltenCore: Story = { args: { instanceName: "Molten Core" } }
export const BlackwingLair: Story = { args: { instanceName: "Blackwing Lair" } }
export const HateforgeQuarry: Story = { args: { instanceName: "Hateforge Quarry" } }
export const TempleOfAhnQiraj: Story = { args: { instanceName: "Temple of Ahn'Qiraj" } }
export const RuinsOfAhnQiraj: Story = { args: { instanceName: "Ruins of Ahn'Qiraj" } }
export const Naxxramas: Story = { args: { instanceName: "Naxxramas" } }
export const EmeraldSanctum: Story = { args: { instanceName: "Emerald Sanctum" } }
export const ZulGurub: Story = { args: { instanceName: "Zul'Gurub" } }
export const OnyxiasLair: Story = { args: { instanceName: "Onyxia's Lair" } }
export const KarazhanCrypts: Story = { args: { instanceName: "Karazhan Crypts" } }
export const TowerOfKarazhan: Story = { args: { instanceName: "Tower of Karazhan" } }
export const FrostmaneHollow: Story = { args: { instanceName: "Frostmane Hollow" } }
export const DefaultFallback: Story = { args: { instanceName: "__default__" } }

export const AllInstances: StoryObj = {
  render: () => <AllParticles />,
  parameters: { layout: "fullscreen" },
}
