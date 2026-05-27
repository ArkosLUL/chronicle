import { useState } from "react";
import { Link } from "react-router-dom";
import { getInstanceBackground, getInstanceAbbrev } from "../utils/instanceImages";
import { HeroicBadge } from "@/components/HeroicBadge";
import { isHeroic } from "@/lib/wowUtils";
import { formatDuration, type InstanceWithMeta } from "../utils/calendarUtils";

interface InstanceDayCardProps {
  instance: InstanceWithMeta;
  showDuration?: boolean;
}

export function InstanceDayCard({ instance, showDuration = true }: InstanceDayCardProps) {
  const [imageError, setImageError] = useState(false);
  const backgroundImage = getInstanceBackground(instance.name);
  const abbrev = getInstanceAbbrev(instance.name);
  const duration = formatDuration(instance.durationMs);
  
  // Build instance URL - prefer slug if available
  const instanceUrl = instance.slug
    ? `/instances/${instance.slug}`
    : `/instances/${instance.id}`;

  return (
    <Link to={instanceUrl} className="block">
      <div className="relative h-10 sm:h-12 rounded overflow-hidden group cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md">
        {/* Solid color fallback background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-800" />

        {/* Background image */}
        {!imageError && (
          <img
            src={backgroundImage}
            alt=""
            onError={() => setImageError(true)}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            style={{
              objectPosition: "center 35%",
            }}
          />
        )}

        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/40" />

        {/* Content */}
        <div className="relative z-10 h-full flex items-center justify-between px-2">
          <span className="text-xs font-medium text-white truncate drop-shadow-lg group-hover:text-amber-300 transition-colors">
            <span className="sm:hidden">{abbrev}</span>
            <span className="hidden sm:inline">{instance.name}</span>
            {instance.max_players > 0 && (
              <span className="ml-1.5 text-[10px] text-white/80 font-semibold">
                {instance.max_players}P
              </span>
            )}
          </span>
          <span className="flex items-center gap-1 ml-1 flex-shrink-0">
            {isHeroic(instance) && (
              <HeroicBadge size="sm" />
            )}
            {showDuration && duration && (
              <span className={`hidden sm:inline text-[10px] text-white/80 px-1.5 py-0.5 rounded ${isHeroic(instance) ? 'bg-purple-600/40' : 'bg-black/40'}`}>
                {duration}
              </span>
            )}
          </span>
        </div>
      </div>
    </Link>
  );
}
