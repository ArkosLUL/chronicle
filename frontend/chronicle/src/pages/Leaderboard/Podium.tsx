import { Link } from "react-router-dom"
import { Users } from "lucide-react"
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
  { minH: "min-h-[210px]", width: "w-64", logo: "h-14 w-14", medal: "text-3xl", duration: "text-2xl", name: "text-lg", pad: "p-5" },     // 1st
  { minH: "min-h-[160px]", width: "w-52", logo: "h-9 w-9", medal: "text-xl", duration: "text-lg", name: "text-sm", pad: "p-4" },         // 3rd
] as const

interface PodiumProps {
  entries: SpeedrunLeaderboardEntry[]
}

export function Podium({ entries }: PodiumProps) {
  if (entries.length === 0) return null

  return (
    <div className="flex items-end justify-center gap-4 mb-10">
      {PODIUM_ORDER.map((rank, displayIdx) => {
        const entry = entries[rank]
        if (!entry) return <div key={rank} className="w-48" />
        const colors = MEDAL_COLORS[rank]
        const style = PODIUM_STYLES[displayIdx]

        return (
            <Link
              key={entry.instance_id}
              to={`/instances/${entry.slug || entry.instance_id}`}
              className={`
                ${style.width} ${style.minH} ${style.pad} rounded-xl border bg-gradient-to-b flex flex-col items-center justify-end text-center
                transition-transform hover:scale-[1.02] hover:-translate-y-1
                ${colors.bg} ${colors.border} ${colors.glow}
              `}
            >
              {entry.guild_logo_url ? (
                <img
                  src={entry.guild_logo_url}
                  alt=""
                  className={`${style.logo} rounded-full object-cover mb-2 ring-2 ring-white/20`}
                />
              ) : (
                <span className={`${style.medal} mb-2`}>{colors.medal}</span>
              )}
              <span className={`${style.name} font-bold ${colors.text} truncate w-full`}>
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
            </Link>
        )
      })}
    </div>
  )
}
