import type { WoWSpell, LocaleIndex } from "@/api/wowdb";
import { getSpellIconUrl } from "@/api/wowdb";
import { SpellTooltip } from "@/pages/WoWDB/SpellTooltip";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/Tooltip/tooltip";
import { cn } from "@/lib/utils";

interface SpellIconWithTooltipProps {
  spell: WoWSpell;
  locale?: LocaleIndex;
  /** Icon size in pixels. Defaults to 24. */
  size?: number;
  /** Additional classes for the icon image */
  className?: string;
  /** Whether to show the tooltip. Defaults to true. */
  showTooltip?: boolean;
}

/**
 * A spell icon that shows the full SpellTooltip on hover.
 * Reusable across the site wherever spell icons are displayed.
 */
export function SpellIconWithTooltip({
  spell,
  locale = "0",
  size = 24,
  className,
  showTooltip = true,
}: SpellIconWithTooltipProps) {
  const iconUrl = getSpellIconUrl(spell.spell_icon);

  if (!iconUrl) {
    return null;
  }

  const icon = (
    <img
      src={iconUrl}
      alt=""
      width={size}
      height={size}
      className={cn(
        "rounded border border-yellow-600/40 flex-shrink-0",
        className
      )}
    />
  );

  if (!showTooltip) {
    return icon;
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>
          <span className="cursor-pointer">{icon}</span>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          align="start"
          sideOffset={8}
          className="p-0 bg-transparent border-0"
          hideArrow
        >
          <SpellTooltip spell={spell} locale={locale} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
