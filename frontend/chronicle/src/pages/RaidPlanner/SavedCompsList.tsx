import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { useMyRaidCompositions } from "@/api/queries";
import type { RaidComposition } from "@/api/typesGenerated";
import { formatLastSeen } from "@/pages/GuildPage/panels/rosterUtils";
import { GROUP_SIZE } from "./types";

const PREVIEW_COUNT = 3;

/**
 * Recent saved compositions under the size wizard (design 9a): pick one to
 * open it instead of building from scratch.
 */
export function SavedCompsList({
  enabled,
  onOpen,
}: {
  enabled: boolean;
  onOpen: (comp: RaidComposition) => void;
}) {
  const { data } = useMyRaidCompositions(enabled);
  const [showAll, setShowAll] = useState(false);

  const comps = data?.compositions ?? [];
  if (comps.length === 0) return null;

  const visible = showAll ? comps : comps.slice(0, PREVIEW_COUNT);

  return (
    <div className="w-[360px] max-w-full mx-auto -mt-6 pb-12">
      <div className="flex items-center gap-3 my-4">
        <span className="flex-1 h-px bg-border" />
        <span className="text-[11px] text-muted-foreground">or start from a saved comp</span>
        <span className="flex-1 h-px bg-border" />
      </div>
      <div className="flex flex-col gap-1.5">
        {visible.map((comp) => {
          const total = comp.data.groups * GROUP_SIZE;
          return (
            <button
              key={comp.id}
              onClick={() => onOpen(comp)}
              className="flex items-center gap-3 px-3 py-2 rounded-md border border-border bg-card text-left hover:border-ring transition-colors"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-medium text-foreground truncate">
                  {comp.name}
                </span>
                <span className="block text-[10px] text-muted-foreground">
                  {total}-man · {comp.data.groups} {comp.data.groups === 1 ? "group" : "groups"} ·{" "}
                  {comp.data.placements.length}/{total} filled
                </span>
              </span>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {formatLastSeen(comp.updated_at)}
              </span>
            </button>
          );
        })}
      </div>
      {comps.length > PREVIEW_COUNT && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-2.5 mx-auto flex items-center gap-1 text-[11px] text-primary hover:opacity-80 transition-opacity"
        >
          All saved compositions <ArrowRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
