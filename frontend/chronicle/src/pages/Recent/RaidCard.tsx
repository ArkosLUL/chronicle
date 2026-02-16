import { useState } from "react";
import { Link } from "react-router-dom";
import { Clock, Users, Swords, CheckCircle, XCircle } from "lucide-react";
import type { RecentInstance } from "@/api/typesGenerated";

// Unified instance configuration - one place to configure each instance
// bossCount is the static total number of bosses for the instance
interface InstanceConfig {
  background: string;
  bossCount?: number; // Optional - dungeons may not need this
}

const INSTANCE_CONFIG: Record<string, InstanceConfig> = {
  // 40-man Raids
  "Molten Core": { background: "/images/loadingscreens/LoadScreenMoltenCore.webp", bossCount: 12 },
  "Blackwing Lair": { background: "/images/loadingscreens/LoadScreenBlackWingLair.webp", bossCount: 8 },
  "Temple of Ahn'Qiraj": { background: "/images/loadingscreens/LoadScreenAhnQiraj40man.webp", bossCount: 9 },
  "Naxxramas": { background: "/images/loadingscreens/LoadScreenNaxxramas.webp", bossCount: 15 },
  "Emerald Sanctum": { background: "/images/loadingscreens/LoadScreenEmeraldSanctum.webp", bossCount: 2 },
  // 20-man Raids
  "Zul'Gurub": { background: "/images/loadingscreens/LoadScreenZulGurub.webp", bossCount: 10 },
  "Ruins of Ahn'Qiraj": { background: "/images/loadingscreens/LoadScreenAhnQiraj20man.webp", bossCount: 6 },
  // Single Boss
  "Onyxia's Lair": { background: "/images/loadingscreens/LoadScreenRaid.webp", bossCount: 1 },
  // Turtle WoW Custom
  "Tower of Karazhan": { background: "/images/loadingscreens/LoadScreenKarazhan.webp", bossCount: 5 },
  "Karazhan Crypts": { background: "/images/loadingscreens/LoadscreenKarazhanCrypt.webp", bossCount: 3 },
  "Hateforge Quarry": { background: "/images/loadingscreens/LoadScreenHateforge.webp", bossCount: 4 },
  "Gilneas City": { background: "/images/loadingscreens/LoadScreenGilneasCity.webp", bossCount: 3 },
  "World Bosses": { background: "/images/loadingscreens/LoadScreenRaid.webp" },
  // Dungeons (bossCount optional - falls back to API value)
  "Upper Blackrock Spire": { background: "/images/loadingscreens/LoadScreenBlackrockSpire.webp", bossCount: 5 },
  "Lower Blackrock Spire": { background: "/images/loadingscreens/LoadScreenBlackrockSpire.webp" },
  "Deadmines": { background: "/images/loadingscreens/LoadScreenDeadmines.webp", bossCount: 8 },
  "Shadowfang Keep": { background: "/images/loadingscreens/LoadScreenShadowFangKeep.webp" },
  "Scarlet Monastery": { background: "/images/loadingscreens/LoadScreenMonastery.webp" },
  "Scarlet Monastery Library": { background: "/images/loadingscreens/LoadScreenMonastery.webp", bossCount: 3 },
  "Scarlet Monastery Cathedral": { background: "/images/loadingscreens/LoadScreenMonastery.webp", bossCount: 2 },
  "Scarlet Monastery Graveyard": { background: "/images/loadingscreens/LoadScreenMonastery.webp" },
  "Scarlet Monastery Armory": { background: "/images/loadingscreens/LoadScreenMonastery.webp" },
  "Stratholme": { background: "/images/loadingscreens/LoadScreenStrathome.webp" },
  "Scholomance": { background: "/images/loadingscreens/LoadScreenScholomance.webp" },
  "Blackrock Depths": { background: "/images/loadingscreens/LoadScreenBlackrockDepths.webp" },
  "Dire Maul": { background: "/images/loadingscreens/LoadScreenDireMaul.webp" },
  "Maraudon": { background: "/images/loadingscreens/LoadScreenMaraudon.webp" },
  "Sunken Temple": { background: "/images/loadingscreens/LoadScreenSunkenTemple.webp" },
  "Zul'Farrak": { background: "/images/loadingscreens/LoadScreenZulFarrak.webp" },
  "Uldaman": { background: "/images/loadingscreens/LoadScreenUldaman.webp" },
  "Razorfen Downs": { background: "/images/loadingscreens/LoadScreenRazorfenDowns.webp" },
  "Razorfen Kraul": { background: "/images/loadingscreens/LoadScreenRazorfenKraul.webp" },
  "Wailing Caverns": { background: "/images/loadingscreens/LoadScreenWailingCaverns.webp" },
  "Blackfathom Deeps": { background: "/images/loadingscreens/LoadScreenBlackFathomDeeps.webp" },
  "Gnomeregan": { background: "/images/loadingscreens/LoadScreenGnomeregan.webp" },
  "Ragefire Chasm": { background: "/images/loadingscreens/LoadScreenRagefireChasm.webp", bossCount:4 },
  "Stormwind Stockade": { background: "/images/loadingscreens/LoadScreenStormwindStockade.webp" },
  "Caverns of Time": { background: "/images/loadingscreens/LoadScreenCavernsTime.webp" },
};

const DEFAULT_BACKGROUND = "/images/loadingscreens/LoadScreenDungeon.webp";

function getInstanceConfig(name: string): InstanceConfig | undefined {
  return INSTANCE_CONFIG[name];
}

function getInstanceBackground(name: string): string {
  return INSTANCE_CONFIG[name]?.background ?? DEFAULT_BACKGROUND;
}

function formatDuration(ms: number | null): string {
  if (ms === null || ms === 0) return "—";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface RaidCardProps {
  instance: RecentInstance;
}

export function RaidCard({ instance }: RaidCardProps) {
  const [imageError, setImageError] = useState(false);
  const uploadedAt = new Date(instance.uploaded_at);
  const backgroundImage = getInstanceBackground(instance.name);
  
  // Use static boss count if configured, otherwise fall back to API value
  const config = getInstanceConfig(instance.name);
  const displayBossCount = config?.bossCount ?? instance.boss_count;
  const isFullClear = instance.boss_kills === displayBossCount && displayBossCount > 0;
  
  // Build instance URL - prefer slug if available
  const instanceUrl = instance.slug 
    ? `/instances/${instance.slug}` 
    : `/instances/${instance.id}`;

  return (
    <Link to={instanceUrl}>
      <div className="relative h-full rounded-lg overflow-hidden group cursor-pointer transition-all hover:scale-[1.02] hover:shadow-xl">
        {/* Solid color fallback background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900" />
        
        {/* Background image - cropped to hide top/bottom decorative borders */}
        {!imageError && (
          <img
            src={backgroundImage}
            alt=""
            onError={() => setImageError(true)}
            className="absolute transition-transform duration-300 group-hover:scale-105 object-cover"
            style={{ 
              objectPosition: "center 35%", // Shift image up to show more of the artwork
              // Extend beyond container bounds to crop the decorative borders
              // WoW loading screens have ~12% borders at top and bottom
              top: "-15%",
              bottom: "-10%",
              left: 0,
              right: 0,
              width: "100%",
              height: "125%", // Taller than container to allow cropping
            }}
          />
        )}
        
        {/* Dark gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/30" />
        
        {/* Content */}
        <div className="relative z-10 p-4 h-full flex flex-col min-h-[200px]">
          {/* Header: Instance name */}
          <div className="mb-2">
            <h3 className="font-bold text-base text-white drop-shadow-lg group-hover:text-amber-300 transition-colors">
              {instance.name}
            </h3>
            <p className="text-xs text-white/70 drop-shadow">
              {instance.guild_name ? (
                <>
                  <span className="text-amber-300/90">&lt;{instance.guild_name}&gt;</span>
                  <span className="mx-1">·</span>
                  by {instance.uploader_name}
                </>
              ) : (
                <>by {instance.uploader_name}</>
              )}
            </p>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Stats row */}
          <div className="flex items-center gap-3 text-xs text-white/80 mb-2">
            <span className="flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded">
              <Users className="h-3 w-3" />
              {instance.player_count}
            </span>
            <span data-chromatic="ignore" className="flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded">
              <Clock className="h-3 w-3" />
              {formatDuration(instance.duration_ms)}
            </span>
          </div>

          {/* Boss progress */}
          <div className="flex items-center gap-2 mb-2">
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${
              isFullClear 
                ? "bg-green-500/30 text-green-300" 
                : "bg-black/40 text-white/90"
            }`}>
              <Swords className="h-3.5 w-3.5" />
              <span className="text-sm font-semibold">
                {instance.boss_kills}/{displayBossCount}
              </span>
              {isFullClear && <CheckCircle className="h-3.5 w-3.5" />}
            </div>
          </div>

          {/* Encounter tags (optional, show first few) */}
          {instance.encounters && instance.encounters.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {instance.encounters
                .filter(e => e.boss)
                .slice(0, 3)
                .map((enc, i) => {
                  const styleClasses = 
                    enc.kill_type === "clean" ? "bg-green-500/30 text-green-300" :
                    enc.kill_type === "partial" ? "bg-yellow-500/30 text-yellow-300" :
                    "bg-red-500/30 text-red-300";
                  return (
                    <span
                      key={i}
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${styleClasses}`}
                    >
                      {enc.kill_type !== "wipe" ? (
                        <CheckCircle className="h-2.5 w-2.5" />
                      ) : (
                        <XCircle className="h-2.5 w-2.5" />
                      )}
                      <span className="truncate max-w-[70px]">{enc.name}</span>
                    </span>
                  );
                })}
              {instance.encounters.filter(e => e.boss).length > 3 && (
                <span className="text-xs text-white/60 bg-black/40 px-1.5 py-0.5 rounded">
                  +{instance.encounters.filter(e => e.boss).length - 3}
                </span>
              )}
            </div>
          )}

          {/* Footer: Time and realm */}
          <div data-chromatic="ignore" className="pt-2 border-t border-white/20 flex items-center justify-between text-xs text-white/60">
            <span>{formatRelativeTime(uploadedAt)}</span>
            <span className="truncate ml-2">{instance.realm_name}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
