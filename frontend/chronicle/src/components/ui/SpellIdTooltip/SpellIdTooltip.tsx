import { useState } from "react";
import { useSpell } from "@/api/queries";
import { SpellIconWithTooltip } from "../SpellIconWithTooltip";

interface SpellIdTooltipProps {
  /** Spell ID to look up. If null, just shows the name as plain text. */
  spellId: number | null;
  /** Fallback display name when spell data isn't loaded or spellId is null */
  name: string;
  /** Icon size in pixels. Defaults to 16. */
  size?: number;
  /** Additional class name for the wrapper */
  className?: string;
}

/**
 * Displays a spell name with an icon that shows a tooltip on hover.
 * Lazy-loads the spell data only when hovered to minimize API calls.
 * Cross-spell references (like $3137s1) are resolved by SpellTooltip internally.
 * 
 * If spellId is null, renders just the name as plain text.
 */
export function SpellIdTooltip({ 
  spellId, 
  name, 
  size = 16,
  className,
}: SpellIdTooltipProps) {
  const [hovered, setHovered] = useState(false);
  
  // Only fetch when hovered and we have a spell ID
  const { data: spell } = useSpell(
    spellId?.toString() ?? "", 
    { enabled: hovered && spellId != null }
  );

  // No spell ID - render plain text
  if (spellId == null) {
    return <span className={className}>{name}</span>;
  }

  return (
    <span 
      className={className}
      onMouseEnter={() => setHovered(true)}
    >
      {spell ? (
        <SpellIconWithTooltip 
          spell={spell} 
          size={size} 
          showTooltip 
          hideDuration 
          hideEffects
        >
          {name}
        </SpellIconWithTooltip>
      ) : (
        // Show name while loading or if fetch fails
        <span>{name}</span>
      )}
    </span>
  );
}
