import { useState } from "react";
import { Link } from "react-router-dom";
import { Clock, Users, Swords, CheckCircle, XCircle } from "lucide-react";
import type { RecentInstance } from "@/api/typesGenerated";

// Map instance names to their loading screen images (WebP format for smaller file sizes)
// The loading screens have decorative borders at top (~12%) and bottom (~12%)
// We use object-position to crop them out
const INSTANCE_BACKGROUNDS: Record<string, string> = {
  "Molten Core": "/images/loadingscreens/LoadScreenMoltenCore.webp",
  "Blackwing Lair": "/images/loadingscreens/LoadScreenBlackWingLair.webp",
  "Onyxia's Lair": "/images/loadingscreens/LoadScreenRaid.webp",
  "Zul'Gurub": "/images/loadingscreens/LoadScreenZulGurub.webp",
  "Ruins of Ahn'Qiraj": "/images/loadingscreens/LoadScreenAhnQiraj20man.webp",
  "Temple of Ahn'Qiraj": "/images/loadingscreens/LoadScreenAhnQiraj40man.webp",
  "Naxxramas": "/images/loadingscreens/LoadScreenNaxxramas.webp",
  "World Bosses": "/images/loadingscreens/LoadScreenRaid.webp",
  "Emerald Sanctum": "/images/loadingscreens/LoadScreenEmeraldSanctum.webp",
  "Karazhan": "/images/loadingscreens/LoadScreenKarazhan.webp",
  "Karazhan Crypts": "/images/loadingscreens/LoadscreenKarazhanCrypt.webp",
  "Hateforge Quarry": "/images/loadingscreens/LoadScreenHateforge.webp",
  "Gilneas City": "/images/loadingscreens/LoadScreenGilneasCity.webp",
  // Dungeons
  "Deadmines": "/images/loadingscreens/LoadScreenDeadmines.webp",
  "Shadowfang Keep": "/images/loadingscreens/LoadScreenShadowFangKeep.webp",
  "Scarlet Monastery": "/images/loadingscreens/LoadScreenMonastery.webp",
  "Scarlet Monastery Library": "/images/loadingscreens/LoadScreenMonastery.webp",
  "Scarlet Monastery Cathedral": "/images/loadingscreens/LoadScreenMonastery.webp",
  "Scarlet Monastery Graveyard": "/images/loadingscreens/LoadScreenMonastery.webp",
  "Scarlet Monastery Armory": "/images/loadingscreens/LoadScreenMonastery.webp",
  "Stratholme": "/images/loadingscreens/LoadScreenStrathome.webp",
  "Scholomance": "/images/loadingscreens/LoadScreenScholomance.webp",
  "Blackrock Depths": "/images/loadingscreens/LoadScreenBlackrockDepths.webp",
  "Lower Blackrock Spire": "/images/loadingscreens/LoadScreenBlackrockSpire.webp",
  "Upper Blackrock Spire": "/images/loadingscreens/LoadScreenBlackrockSpire.webp",
  "Dire Maul": "/images/loadingscreens/LoadScreenDireMaul.webp",
  "Maraudon": "/images/loadingscreens/LoadScreenMaraudon.webp",
  "Sunken Temple": "/images/loadingscreens/LoadScreenSunkenTemple.webp",
  "Zul'Farrak": "/images/loadingscreens/LoadScreenZulFarrak.webp",
  "Uldaman": "/images/loadingscreens/LoadScreenUldaman.webp",
  "Razorfen Downs": "/images/loadingscreens/LoadScreenRazorfenDowns.webp",
  "Razorfen Kraul": "/images/loadingscreens/LoadScreenRazorfenKraul.webp",
  "Wailing Caverns": "/images/loadingscreens/LoadScreenWailingCaverns.webp",
  "Blackfathom Deeps": "/images/loadingscreens/LoadScreenBlackFathomDeeps.webp",
  "Gnomeregan": "/images/loadingscreens/LoadScreenGnomeregan.webp",
  "Ragefire Chasm": "/images/loadingscreens/LoadScreenRagefireChasm.webp",
  "Stormwind Stockade": "/images/loadingscreens/LoadScreenStormwindStockade.webp",
  "Caverns of Time": "/images/loadingscreens/LoadScreenCavernsTime.webp",
};

// Fallback background for unknown instances
const DEFAULT_BACKGROUND = "/images/loadingscreens/LoadScreenDungeon.webp";

function getInstanceBackground(name: string): string {
  return INSTANCE_BACKGROUNDS[name] ?? DEFAULT_BACKGROUND;
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
  const isFullClear = instance.boss_kills === instance.boss_count && instance.boss_count > 0;
  const backgroundImage = getInstanceBackground(instance.name);
  
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
              by {instance.uploader_name}
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
            <span className="flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded">
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
                {instance.boss_kills}/{instance.boss_count}
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
                .map((enc, i) => (
                  <span
                    key={i}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${
                      enc.kill
                        ? "bg-green-500/30 text-green-300"
                        : "bg-red-500/30 text-red-300"
                    }`}
                  >
                    {enc.kill ? (
                      <CheckCircle className="h-2.5 w-2.5" />
                    ) : (
                      <XCircle className="h-2.5 w-2.5" />
                    )}
                    <span className="truncate max-w-[70px]">{enc.name}</span>
                  </span>
                ))}
              {instance.encounters.filter(e => e.boss).length > 3 && (
                <span className="text-xs text-white/60 bg-black/40 px-1.5 py-0.5 rounded">
                  +{instance.encounters.filter(e => e.boss).length - 3}
                </span>
              )}
            </div>
          )}

          {/* Footer: Time and realm */}
          <div className="pt-2 border-t border-white/20 flex items-center justify-between text-xs text-white/60">
            <span>{formatRelativeTime(uploadedAt)}</span>
            <span className="truncate ml-2">{instance.realm_name}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
