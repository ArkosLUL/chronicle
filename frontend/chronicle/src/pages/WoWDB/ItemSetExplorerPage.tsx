import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Search, Loader2, Shield, X } from "lucide-react";
import { useSearchItemSets, useItemTooltip } from "@/api/gamedata";
import { ItemTooltip } from "@/components/ui/ItemTooltip";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/Tooltip/tooltip";
import { cn } from "@/lib/utils";
import type { ItemSetSearchResult } from "@/api/typesGenerated";

// --- Label maps ---

const QUALITY_COLORS: Record<number, string> = {
  0: "text-quality-poor",
  1: "text-quality-common",
  2: "text-quality-uncommon",
  3: "text-quality-rare",
  4: "text-quality-epic",
  5: "text-quality-legendary",
  6: "text-quality-artifact",
};

const SKILL_LABELS: Record<number, string> = {
  164: "Blacksmithing", 165: "Leatherworking", 171: "Alchemy",
  182: "Herbalism", 185: "Cooking", 186: "Mining", 197: "Tailoring",
  202: "Engineering", 333: "Enchanting", 356: "Fishing", 393: "Skinning",
  129: "First Aid",
};

// --- Components ---

const GRID_COLS = "grid-cols-[1fr_60px_80px_120px]";

function SetHoverTooltip({ itemId, children }: { itemId: number; children: React.ReactNode }) {
  const { data: item } = useItemTooltip(itemId > 0 ? { itemId } : null);

  if (itemId <= 0) return <>{children}</>;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" align="start" sideOffset={4} hideArrow className="p-0 bg-transparent border-0 shadow-none max-w-none">
        {item ? (
          <ItemTooltip item={item} includeReferenceLinks showItemLevel />
        ) : (
          <div className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-gray-400 text-sm">
            Loading…
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function ResultRow({ set }: { set: ItemSetSearchResult }) {
  const skillLabel = set.required_skill > 0
    ? SKILL_LABELS[set.required_skill] ?? `Skill ${set.required_skill}`
    : "";

  return (
    <SetHoverTooltip itemId={set.first_item_entry}>
      <Link
        to={`/wowdb/set?id=${set.id}`}
        className={cn(
          "w-full text-left grid gap-3 items-center px-3 py-1.5 rounded-md transition-colors",
          GRID_COLS,
          "hover:bg-gray-800/80"
        )}
      >
        <span className={cn("font-medium truncate", QUALITY_COLORS[set.max_quality] ?? "text-quality-common")}>{set.name}</span>
        <span className="text-gray-400 text-xs text-right tabular-nums">
          {set.piece_count}
        </span>
        <span className="text-gray-400 text-xs text-right tabular-nums">
          {set.bonus_count}
        </span>
        <span className="text-gray-500 text-xs truncate">{skillLabel}</span>
      </Link>
    </SetHoverTooltip>
  );
}

export function ItemSetExplorerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [inputValue, setInputValue] = useState(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const q = searchParams.get("q") ?? "";

  const { data: results, isLoading, isFetching, error } = useSearchItemSets(
    q.length >= 2 ? q : null
  );

  const updateQ = useCallback(
    (value: string | undefined) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value) {
          next.set("q", value);
        } else {
          next.delete("q");
        }
        return next;
      });
    },
    [setSearchParams]
  );

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateQ(inputValue || undefined);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inputValue, updateQ]);

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search item sets by name..."
            className="w-full bg-gray-800 border border-gray-600 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 transition-colors"
            autoFocus
          />
          {inputValue && (
            <button
              onClick={() => {
                setInputValue("");
                updateQ(undefined);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="space-y-1">
        {/* Column headers */}
        {results && results.length > 0 && (
          <div className="space-y-2 pb-2 border-b border-gray-700/50">
            <div className="flex items-center justify-between text-sm text-gray-400 px-3">
              <span>
                {results.length >= 25 ? "25+ results" : `${results.length} result${results.length !== 1 ? "s" : ""}`}
                {isFetching && <Loader2 className="inline h-3 w-3 animate-spin ml-2" />}
              </span>
              <span className="text-xs text-gray-500">Click to expand set details</span>
            </div>
            <div className={cn("grid gap-3 items-center px-3 text-xs text-gray-500 font-medium", GRID_COLS)}>
              <span>Name</span>
              <span className="text-right">Pieces</span>
              <span className="text-right">Bonuses</span>
              <span>Profession</span>
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading && q.length >= 2 && (
          <div className="flex items-center justify-center gap-2 text-gray-400 py-12">
            <Loader2 className="h-5 w-5 animate-spin" />
            Searching...
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-red-400 text-center py-8">
            {error instanceof Error ? error.message : "Failed to search item sets"}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && q.length >= 2 && results && results.length === 0 && (
          <div className="text-gray-500 text-center py-12">
            No item sets found matching &ldquo;{q}&rdquo;
          </div>
        )}

        {/* Prompt */}
        {q.length < 2 && (
          <div className="text-gray-500 text-center py-12 space-y-2">
            <Shield className="h-10 w-10 mx-auto text-gray-600" />
            <p>Type at least 2 characters to search</p>
            <div className="text-xs text-gray-600 space-x-3 pt-2">
              <span>Try:</span>
              {["Might", "Cenarion", "Netherwind"].map((name) => (
                <button
                  key={name}
                  className="text-blue-400/70 hover:text-blue-400"
                  onClick={() => setInputValue(name)}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results list */}
        {results && results.length > 0 && (
          <div className="space-y-0.5 pt-2">
            {results.map((set) => (
              <ResultRow key={set.id} set={set} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
