import type { UserPanelLayout } from "@/api/queries";
import { getSpellIconUrl } from "@/api/wowdb";
import {
  LAYOUT_ACTION_BAR_KEYS,
  type LayoutActionBarKey,
  type LayoutActionBarSlots,
} from "@/features/layoutBook/layoutBookStore";
import { buildLayoutSpellTooltip } from "@/features/layoutBook/buildLayoutSpellTooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu/DropdownMenu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip/tooltip";
import { SpellTooltip } from "@/pages/WoWDB/SpellTooltip";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface InstanceActionBarProps {
  slots: LayoutActionBarSlots;
  layouts: readonly UserPanelLayout[];
  onAssign?: (key: LayoutActionBarKey, layoutID: string | null) => void;
  onCast?: (layout: UserPanelLayout) => void;
  onResetToDefault?: () => void;
  mobileKeypad?: boolean;
}

type MobileActionBarCell = LayoutActionBarKey | "reset" | null;

const MOBILE_KEYPAD_KEYS: MobileActionBarCell[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", null, "reset"];

export function InstanceActionBar({ slots, layouts, onAssign, onCast, onResetToDefault, mobileKeypad = false }: InstanceActionBarProps) {
  const orderedKeys = mobileKeypad ? MOBILE_KEYPAD_KEYS : LAYOUT_ACTION_BAR_KEYS;

  return (
    <div
      className={cn(
        "rounded-lg border border-zinc-700/70 bg-zinc-950/80 p-1.5",
        mobileKeypad ? "grid grid-cols-3 gap-2 p-2" : "inline-flex max-w-full items-center gap-1 overflow-x-auto",
      )}
    >
      {orderedKeys.map((key, idx) => {
        if (key === null) {
          return <div key={`empty-${idx}`} className="h-14 w-14" aria-hidden="true" />;
        }

        if (key === "reset") {
          return (
            <button
              key="reset"
              type="button"
              onClick={onResetToDefault}
              disabled={!onResetToDefault}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-sm border-2 border-secondary/70 bg-secondary text-secondary-foreground shadow-inner transition-colors hover:bg-secondary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-secondary disabled:cursor-not-allowed disabled:opacity-50"
              title="Reset to default"
              aria-label="Reset to default"
            >
              <RotateCcw className="h-5 w-5" />
            </button>
          );
        }

        const layoutID = slots[key];
        const layout = layoutID ? layouts.find((candidate) => candidate.id === layoutID) ?? null : null;

        return (
          <ActionBarSlot
            key={key}
            hotkey={key}
            layout={layout}
            layouts={layouts}
            isLarge={mobileKeypad}
            onAssign={onAssign ? (layoutID) => onAssign(key, layoutID) : undefined}
            onCast={onCast}
          />
        );
      })}
    </div>
  );
}

function ActionBarSlot({
  hotkey,
  layout,
  layouts,
  onAssign,
  onCast,
  isLarge = false,
}: {
  hotkey: LayoutActionBarKey;
  layout: UserPanelLayout | null;
  layouts: readonly UserPanelLayout[];
  onAssign?: (layoutID: string | null) => void;
  onCast?: (layout: UserPanelLayout) => void;
  isLarge?: boolean;
}) {
  const button = (
    <button
      type="button"
      onClick={() => {
        if (layout && onCast) {
          onCast(layout);
        }
      }}
      onAuxClick={(event) => {
        if (event.button !== 1 || !onAssign) return;
        event.preventDefault();
        onAssign(null);
      }}
      className={cn(
        "relative shrink-0 overflow-hidden rounded-sm border-2 border-zinc-700/80 bg-zinc-900/70 shadow-inner transition-colors hover:border-zinc-500/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400",
        isLarge ? "h-14 w-14" : "h-11 w-11",
      )}
    >
      {layout ? (
        <img
          src={getSpellIconUrl({ ID: 1, TextureFilename: layout.icon || "INV_Misc_Book_09" })}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : null}
      <span className={cn(
        "absolute right-0.5 top-0 font-bold leading-none text-zinc-200/90 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]",
        isLarge ? "text-xs" : "text-[10px]",
      )}>
        {hotkey}
      </span>
    </button>
  );

  if (!onAssign) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent
          side="top"
          className={layout ? "border-0 bg-transparent p-0" : "text-xs"}
          hideArrow={!!layout}
        >
          {layout ? <SpellTooltip spell={buildLayoutSpellTooltip(layout)} /> : `Slot ${hotkey} (empty)`}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>{button}</DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className={layout ? "border-0 bg-transparent p-0" : "text-xs"}
          hideArrow={!!layout}
        >
          {layout ? <SpellTooltip spell={buildLayoutSpellTooltip(layout)} /> : `Slot ${hotkey} (empty)`}
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Assign slot {hotkey}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {layouts.length === 0 ? (
          <DropdownMenuItem disabled>No layouts available</DropdownMenuItem>
        ) : (
          layouts.map((candidate) => (
            <DropdownMenuItem key={candidate.id} onSelect={() => onAssign(candidate.id)}>
              <img
                src={getSpellIconUrl({ ID: 1, TextureFilename: candidate.icon || "INV_Misc_Book_09" })}
                alt=""
                className="mr-2 h-5 w-5 rounded-sm border border-zinc-700/80 object-cover"
                loading="lazy"
              />
              <span className="truncate">{candidate.title}</span>
            </DropdownMenuItem>
          ))
        )}
        {layout ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onAssign(null)} className="text-red-400 focus:text-red-300">
              Clear slot
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

