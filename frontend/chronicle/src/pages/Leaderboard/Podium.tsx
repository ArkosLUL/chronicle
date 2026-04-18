import { Link } from "react-router-dom"
import { Users } from "lucide-react"
import { useEffect, useRef } from "react"
import type { SpeedrunLeaderboardEntry } from "../../api/typesGenerated"

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

const MEDAL_COLORS = [
  { bg: "from-yellow-500/25 to-yellow-600/5", border: "border-yellow-500/40", text: "text-yellow-400", glow: "shadow-yellow-500/20 shadow-lg", medal: "🥇" },
  { bg: "from-slate-300/15 to-slate-400/5", border: "border-slate-400/30", text: "text-slate-300", glow: "", medal: "🥈" },
  { bg: "from-amber-700/15 to-amber-800/5", border: "border-amber-700/30", text: "text-amber-600", glow: "", medal: "🥉" },
] as const

// Display order: 2nd, 1st, 3rd
const PODIUM_ORDER = [1, 0, 2] as const
const PODIUM_STYLES = [
  { minH: "min-h-[180px]", width: "w-56", logo: "h-10 w-10", medal: "text-2xl", duration: "text-xl", name: "text-base", pad: "p-4" },   // 2nd
  { minH: "min-h-[260px]", width: "w-72", logo: "h-16 w-16", medal: "text-4xl", duration: "text-3xl", name: "text-xl", pad: "p-6" },     // 1st
  { minH: "min-h-[160px]", width: "w-52", logo: "h-9 w-9", medal: "text-xl", duration: "text-lg", name: "text-sm", pad: "p-4" },         // 3rd
] as const

// Per-instance glow/particle themes for #1
interface InstanceTheme {
  glow: string       // box-shadow glow color
  particles: string[] // particle colors (small dots that float up)
  border: string     // border color override for #1
}

const INSTANCE_THEMES: Record<string, InstanceTheme> = {
  "Molten Core": {
    glow: "rgba(239, 68, 68, 0.35)",
    particles: ["#ef4444", "#f97316", "#fbbf24", "#dc2626"],
    border: "rgba(239, 68, 68, 0.5)",
  },
  "Blackwing Lair": {
    glow: "rgba(139, 92, 246, 0.35)",
    particles: ["#8b5cf6", "#6366f1", "#a78bfa", "#312e81"],
    border: "rgba(139, 92, 246, 0.5)",
  },
  "Temple of Ahn'Qiraj": {
    glow: "rgba(217, 170, 66, 0.35)",
    particles: ["#d9aa42", "#c9880c", "#e8cc6a", "#a67c00"],
    border: "rgba(217, 170, 66, 0.5)",
  },
  "Naxxramas": {
    glow: "rgba(74, 222, 128, 0.3)",
    particles: ["#4ade80", "#22c55e", "#86efac", "#166534"],
    border: "rgba(74, 222, 128, 0.45)",
  },
  "Emerald Sanctum": {
    glow: "rgba(52, 211, 153, 0.3)",
    particles: ["#34d399", "#10b981", "#6ee7b7", "#065f46"],
    border: "rgba(52, 211, 153, 0.45)",
  },
  "Zul'Gurub": {
    glow: "rgba(234, 88, 12, 0.35)",
    particles: ["#ea580c", "#16a34a", "#f97316", "#22c55e"],
    border: "rgba(234, 88, 12, 0.5)",
  },
  "Onyxia's Lair": {
    glow: "rgba(99, 102, 241, 0.35)",
    particles: ["#6366f1", "#818cf8", "#4f46e5", "#a5b4fc"],
    border: "rgba(99, 102, 241, 0.5)",
  },
}

const DEFAULT_THEME: InstanceTheme = {
  glow: "rgba(234, 179, 8, 0.3)",
  particles: ["#eab308", "#facc15", "#ca8a04", "#fde68a"],
  border: "rgba(234, 179, 8, 0.45)",
}

function ParticleEffect({ instanceName }: { instanceName: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const theme = INSTANCE_THEMES[instanceName] ?? DEFAULT_THEME

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    interface Particle {
      x: number; y: number; vy: number; vx: number
      size: number; alpha: number; color: string; life: number; maxLife: number
    }

    const particles: Particle[] = []
    let animId: number

    function spawn() {
      if (particles.length > 18) return
      const color = theme.particles[Math.floor(Math.random() * theme.particles.length)]
      particles.push({
        x: Math.random() * rect.width,
        y: rect.height + 2,
        vy: -(0.3 + Math.random() * 0.6),
        vx: (Math.random() - 0.5) * 0.3,
        size: 1.5 + Math.random() * 2,
        alpha: 0.6 + Math.random() * 0.4,
        color,
        life: 0,
        maxLife: 60 + Math.random() * 80,
      })
    }

    function tick() {
      ctx!.clearRect(0, 0, rect.width, rect.height)
      if (Math.random() < 0.3) spawn()

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.life++
        p.x += p.vx
        p.y += p.vy
        const progress = p.life / p.maxLife
        const alpha = p.alpha * (1 - progress)

        if (alpha <= 0 || p.life >= p.maxLife) {
          particles.splice(i, 1)
          continue
        }

        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.size * (1 - progress * 0.5), 0, Math.PI * 2)
        ctx!.fillStyle = p.color
        ctx!.globalAlpha = alpha
        ctx!.fill()
      }
      ctx!.globalAlpha = 1
      animId = requestAnimationFrame(tick)
    }

    animId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animId)
  }, [theme])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 1 }}
    />
  )
}

interface PodiumProps {
  entries: SpeedrunLeaderboardEntry[]
  instanceName: string
}

export function Podium({ entries, instanceName }: PodiumProps) {
  if (entries.length === 0) return null
  const theme = INSTANCE_THEMES[instanceName] ?? DEFAULT_THEME

  return (
    <div className="flex items-end justify-center gap-6 mb-10">
      {PODIUM_ORDER.map((rank, displayIdx) => {
        const entry = entries[rank]
        if (!entry) return <div key={rank} className="w-48" />
        const colors = MEDAL_COLORS[rank]
        const style = PODIUM_STYLES[displayIdx]
        const isFirst = rank === 0

        const shadow = isFirst
          ? `0 4px 24px ${theme.glow}, 0 8px 48px ${theme.glow}, 0 0 100px ${theme.glow}`
          : rank === 1
            ? "0 4px 16px rgba(148,163,184,0.15), 0 8px 32px rgba(148,163,184,0.08)"
            : "0 4px 12px rgba(120,80,30,0.12), 0 8px 24px rgba(120,80,30,0.06)"

        return (
          <Link
            key={entry.instance_id}
            to={`/instances/${entry.slug || entry.instance_id}`}
            className={`relative overflow-hidden
              ${style.width} ${style.minH} ${style.pad} rounded-xl border bg-gradient-to-b flex flex-col items-center justify-end text-center
              transition-all duration-200 hover:-translate-y-2
              ${isFirst ? "" : colors.bg} ${isFirst ? "" : colors.border}
            `}
            style={{
              ...(isFirst ? {
                borderColor: theme.border,
                backgroundImage: `linear-gradient(to bottom, ${theme.glow}, transparent)`,
              } : {}),
              boxShadow: shadow,
            }}
          >
            {isFirst && <ParticleEffect instanceName={instanceName} />}
            <div className="relative z-10 flex flex-col items-center w-full">
              {entry.guild_logo_url ? (
                <img
                  src={entry.guild_logo_url}
                  alt=""
                  className={`${style.logo} rounded-full object-cover mb-2 ring-2 ring-white/20`}
                />
              ) : (
                <span className={`${style.medal} mb-2`}>{colors.medal}</span>
              )}
              <span className={`${style.name} font-bold ${isFirst ? "text-white" : colors.text} truncate w-full`}>
                {entry.guild_name || "Unknown Guild"}
              </span>
              <span className={`${style.duration} font-mono font-bold text-foreground mt-1`}>
                {formatDuration(entry.duration_ms)}
              </span>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {entry.player_count}
                </span>
                <span>{entry.realm_name}</span>
              </div>
              <span className="text-xs text-muted-foreground mt-1">
                {formatDate(entry.completion_time)}
              </span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
