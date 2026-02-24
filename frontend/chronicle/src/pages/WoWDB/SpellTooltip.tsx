import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import type { WoWSpell, LocaleIndex } from "@/api/wowdb";
import {
  getLocalizedText,
  getSpellIconUrl,
  formatCastTime,
  formatRange,
  formatCooldown,
  formatDuration,
  resolveSpellDescription,
  extractReferencedSpellIds,
  SCHOOL_COLORS,
} from "@/api/wowdb";

interface SpellTooltipProps {
  spell: WoWSpell;
  locale?: LocaleIndex;
  /** Hide the duration line (useful when duration is shown elsewhere) */
  hideDuration?: boolean;
  /** Hide the effect descriptions (useful when context already explains the effect) */
  hideEffects?: boolean;
}

export function SpellTooltip({ spell, locale = "0", hideDuration = false, hideEffects = false }: SpellTooltipProps) {
  const name = getLocalizedText(spell.name, locale);
  const rank = getLocalizedText(spell.subtext, locale);
  const descriptionTemplate = getLocalizedText(spell.description, locale);
  const auraDescTemplate = getLocalizedText(spell.aura_description, locale);
  const iconUrl = getSpellIconUrl(spell.spell_icon);
  const cooldown = formatCooldown(spell.recovery_time);
  const schoolColor = SCHOOL_COLORS[spell.school.value] || "text-white";

  // Extract referenced spell IDs from templates
  const referencedIds = useMemo(() => {
    const ids = [
      ...extractReferencedSpellIds(descriptionTemplate),
      ...extractReferencedSpellIds(auraDescTemplate),
    ];
    return [...new Set(ids)];
  }, [descriptionTemplate, auraDescTemplate]);

  // Fetch all referenced spells in parallel
  const refQueries = useQueries({
    queries: referencedIds.map((id) => ({
      queryKey: ["wowdb", "spell", id.toString()],
      queryFn: async () => {
        const response = await fetch(`/api/v1/wowdb/spell/${id}`);
        if (!response.ok) return null;
        return response.json() as Promise<WoWSpell>;
      },
      staleTime: Infinity,
      retry: false,
    })),
  });

  // Build the referenced spells map
  const referencedSpells = useMemo(() => {
    const map = new Map<number, WoWSpell>();
    referencedIds.forEach((id, i) => {
      const data = refQueries[i]?.data;
      if (data) map.set(id, data);
    });
    return map;
  }, [referencedIds, refQueries]);

  // Resolve descriptions with cross-spell references
  const description = resolveSpellDescription(spell, descriptionTemplate, referencedSpells);
  const auraDesc = resolveSpellDescription(spell, auraDescTemplate, referencedSpells);

  // Determine resource cost display
  const hasCost = spell.mana_cost > 0 || spell.mana_cost_pct > 0;
  const costDisplay = spell.mana_cost_pct > 0 
    ? `${spell.mana_cost_pct}% of base ${spell.power_type.string}`
    : `${spell.mana_cost} ${spell.power_type.string}`;

  return (
    <div className="bg-[#1a1a2e] border-2 border-[#4a4a6a] rounded-lg p-4 max-w-md shadow-lg">
      {/* Header with icon */}
      <div className="flex gap-3 items-start">
        {iconUrl && (
          <img
            src={iconUrl}
            alt=""
            width={44}
            height={44}
            className="rounded border-2 border-yellow-600/60 flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start gap-2">
            <h2 className={`font-bold text-lg leading-tight ${schoolColor}`}>
              {name}
            </h2>
            {rank && (
              <span className="text-gray-400 text-sm flex-shrink-0">{rank}</span>
            )}
          </div>
          {spell.spell_level > 0 && (
            <div className="text-gray-500 text-xs mt-0.5">
              Level {spell.spell_level}
            </div>
          )}
        </div>
      </div>

      {/* Cost and Range/Cast row */}
      <div className="mt-3 space-y-1">
        {hasCost && (
          <div className="flex justify-between text-white text-sm">
            <span>{costDisplay}</span>
            <span>{formatRange(spell.range)}</span>
          </div>
        )}
        {!hasCost && (
          <div className="flex justify-end text-white text-sm">
            <span>{formatRange(spell.range)}</span>
          </div>
        )}
        
        {/* Cast time and cooldown */}
        <div className="flex justify-between text-white text-sm">
          <span>{formatCastTime(spell.casting_time)}</span>
          {cooldown && <span>{cooldown}</span>}
        </div>
      </div>

      {/* Duration if applicable */}
      {!hideDuration && spell.duration.Duration > 0 && (
        <div className="text-white text-sm mt-1">
          Duration: {formatDuration(spell.duration)}
        </div>
      )}

      {/* Description */}
      {description && (
        <p className="text-yellow-400 mt-3 text-sm whitespace-pre-wrap leading-relaxed">
          {description}
        </p>
      )}

      {/* Aura description (buff/debuff text) */}
      {!hideEffects && auraDesc && (
        <p className="text-green-400 mt-2 text-sm italic">{auraDesc}</p>
      )}

      {/* School and dispel type info */}
      <div className="mt-3 pt-2 border-t border-gray-700 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
        <span>School: <span className={schoolColor}>{spell.school.string}</span></span>
        {spell.dispel_type.string !== "None" && (
          <span>Dispel: {spell.dispel_type.string}</span>
        )}
        {spell.mechanic.string !== "None" && (
          <span>Mechanic: {spell.mechanic.string}</span>
        )}
      </div>
    </div>
  );
}
