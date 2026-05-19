/**
 * DeathRecap - Shows the last 10 seconds of incoming damage/healing/absorbs before a death
 */

import type { DeathRecapEntry } from "./deaths.processor";
import { Shield, Swords, Heart, ShieldBan, Ban } from "lucide-react";
import { SpellIdTooltip } from "@/components/ui/SpellIdTooltip/SpellIdTooltip";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/Tooltip/tooltip";

/**
 * Get school color for styling
 */
function getSchoolColor(school: number): string {
  const colors: Record<number, string> = {
    2: "text-amber-200",      // Physical
    3: "text-yellow-300",     // Holy
    4: "text-orange-500",     // Fire
    5: "text-green-400",      // Nature
    6: "text-cyan-400",       // Frost
    7: "text-purple-400",     // Shadow
    8: "text-blue-400",       // Arcane
  };
  return colors[school] || "text-muted-foreground";
}

function formatRecapTime(entryOffsetMilli: number, deathOffsetMilli: number): string {
  const diff = (entryOffsetMilli - deathOffsetMilli) / 1000;
  return diff.toFixed(1) + "s";
}

/** Caster name styled by class (player) or red (hostile) */
function CasterName({ entry }: { entry: DeathRecapEntry }) {
  if (entry.casterClass) {
    return (
      <span
        className="truncate"
        style={{ color: `var(--color-class-${entry.casterClass.toLowerCase()})` }}
        title={entry.casterName}
      >
        {entry.casterName}
      </span>
    );
  }
  return (
    <span className="truncate text-red-400" title={entry.casterName}>
      {entry.casterName}
    </span>
  );
}

interface DeathRecapProps {
  recap: DeathRecapEntry[];
  deathOffsetMilli: number;
}

export const DeathRecap = ({ recap, deathOffsetMilli }: DeathRecapProps) => {
  if (recap.length === 0) {
    return (
      <div className="text-2xs text-muted-foreground py-2 px-4 italic">
        No activity recorded in the 10 seconds before death.
      </div>
    );
  }

  // Compute summary
  let totalDamage = 0;
  let totalHealing = 0;
  let totalAbsorbed = 0;
  for (const entry of recap) {
    if (entry.type === "damage") totalDamage += entry.amount;
    else if (entry.type === "heal") totalHealing += entry.amount;
    else if (entry.type === "absorbed") totalAbsorbed += entry.amount;
    else if (entry.type === "resource_change") totalHealing += entry.amount;
  }

  // Show most recent first (closest to death at top)
  const reversed = [...recap].reverse();

  return (
    <div className="bg-muted/30 border border-border/50 rounded mx-2 mb-1">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30">
        <span className="text-2xs font-medium text-muted-foreground">Death Recap (last 10s)</span>
        <div className="flex items-center gap-3 text-2xs">
          <span className="text-red-400">
            <Swords className="inline h-3 w-3 mr-0.5" />
            {totalDamage.toLocaleString()}
          </span>
          <span className="text-green-400">
            <Heart className="inline h-3 w-3 mr-0.5" />
            {totalHealing.toLocaleString()}
          </span>
          {totalAbsorbed > 0 && (
            <span className="text-blue-400">
              <Shield className="inline h-3 w-3 mr-0.5" />
              {totalAbsorbed.toLocaleString()}
            </span>
          )}
        </div>
      </div>
      {/* Entries */}
      <div className="max-h-48 overflow-y-auto styled-scrollbar">
        <table className="w-full text-2xs">
          <tbody>
            {reversed.map((entry, i) => (
              <tr
                key={i}
                className="border-b border-border/10 last:border-b-0 hover:bg-muted/40"
              >
                {/* Time offset */}
                <td className="py-0.5 px-2 font-mono text-muted-foreground w-14 text-right">
                  {formatRecapTime(entry.offsetMilli, deathOffsetMilli)}
                </td>
                {/* Source (caster name) - colored by class or red for hostile */}
                <td className="py-0.5 px-2 max-w-[100px]">
                  <CasterName entry={entry} />
                </td>
                {/* Ability name with icon + tooltip */}
                <td className="py-0.5 px-2 truncate max-w-[120px]">
                  {entry.type === "absorbed" ? (
                    <SpellIdTooltip
                      spellId={entry.absorbSpellId ?? null}
                      name={entry.absorbSpellName || entry.sourceName}
                      size={14}
                      className="text-blue-400"
                    />
                  ) : (
                    <SpellIdTooltip
                      spellId={entry.spellId}
                      name={entry.sourceName}
                      size={14}
                      className={entry.type === "resource_change" ? "text-green-400" : getSchoolColor(entry.school)}
                    />
                  )}
                </td>
                {/* Amount + mitigation */}
                <td className="py-0.5 px-2 font-mono text-right whitespace-nowrap">
                  <RecapAmount entry={entry} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/** Renders the amount cell with mitigation icons for damage, effective+overheal for heals */
function RecapAmount({ entry }: { entry: DeathRecapEntry }) {
  if (entry.type === "heal" || entry.type === "resource_change") {
    const effective = entry.overheal ? entry.amount - entry.overheal : entry.amount;
    return (
      <span className="inline-flex items-center justify-end gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-green-400 cursor-default">+{effective.toLocaleString()}</span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-2xs">Effective healing</TooltipContent>
        </Tooltip>
        {entry.overheal ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-yellow-600 cursor-default">
                +{entry.overheal.toLocaleString()}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-2xs">Overhealing</TooltipContent>
          </Tooltip>
        ) : null}
      </span>
    );
  }

  if (entry.type === "absorbed") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-blue-400 cursor-default">{entry.amount.toLocaleString()}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-2xs">Damage absorbed</TooltipContent>
      </Tooltip>
    );
  }

  // Damage
  return (
    <span className="inline-flex items-center justify-end gap-1.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-red-400 cursor-default">-{entry.amount.toLocaleString()}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-2xs">Damage dealt</TooltipContent>
      </Tooltip>
      {entry.absorbed ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-blue-400 inline-flex items-center cursor-default">
              <Shield className="inline h-2.5 w-2.5 mr-px" />
              {entry.absorbed.toLocaleString()}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-2xs">Absorbed</TooltipContent>
        </Tooltip>
      ) : null}
      {entry.resisted ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-purple-400 inline-flex items-center cursor-default">
              <Ban className="inline h-2.5 w-2.5 mr-px" />
              {entry.resisted.toLocaleString()}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-2xs">Resisted</TooltipContent>
        </Tooltip>
      ) : null}
      {entry.blocked ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-amber-400 inline-flex items-center cursor-default">
              <ShieldBan className="inline h-2.5 w-2.5 mr-px" />
              {entry.blocked.toLocaleString()}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-2xs">Blocked</TooltipContent>
        </Tooltip>
      ) : null}
    </span>
  );
}
