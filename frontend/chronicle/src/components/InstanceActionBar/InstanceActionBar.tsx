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

interface InstanceActionBarProps {
  slots: LayoutActionBarSlots;
  layouts: readonly UserPanelLayout[];
  onAssign: (key: LayoutActionBarKey, layoutID: string | null) => void;
}

export function InstanceActionBar({ slots, layouts, onAssign }: InstanceActionBarProps) {
  return (
    <div className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-zinc-700/70 bg-zinc-950/80 p-1.5">
      {LAYOUT_ACTION_BAR_KEYS.map((key) => {
        const layoutID = slots[key];
        const layout = layoutID ? layouts.find((candidate) => candidate.id === layoutID) ?? null : null;

        return (
          <ActionBarSlot
            key={key}
            hotkey={key}
            layout={layout}
            layouts={layouts}
            onAssign={(layoutID) => onAssign(key, layoutID)}
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
}: {
  hotkey: LayoutActionBarKey;
  layout: UserPanelLayout | null;
  layouts: readonly UserPanelLayout[];
  onAssign: (layoutID: string | null) => void;
}) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onAuxClick={(event) => {
                if (event.button !== 1) return;
                event.preventDefault();
                onAssign(null);
              }}
              className="relative h-11 w-11 shrink-0 overflow-hidden rounded-sm border-2 border-zinc-700/80 bg-zinc-900/70 shadow-inner transition-colors hover:border-zinc-500/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400"
            >
              {layout ? (
                <img
                  src={getSpellIconUrl({ ID: 1, TextureFilename: layout.icon || "INV_Misc_Book_09" })}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : null}
              <span className="absolute right-0.5 top-0 text-[10px] font-bold leading-none text-zinc-200/90 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
                {hotkey}
              </span>
            </button>
          </DropdownMenuTrigger>
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

