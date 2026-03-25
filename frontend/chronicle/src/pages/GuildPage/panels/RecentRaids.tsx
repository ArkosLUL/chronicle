import { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar, AlertCircle } from "lucide-react";
import type { RecentInstance, RecentInstancesResponse } from "@/api/typesGenerated";
import { getInstanceCategory } from "@/pages/Logs/utils/instanceImages";
import { RaidCard } from "@/pages/Recent/RaidCard";
import type { GuildPanelDefinition, GuildPanelRenderProps } from "./types";

type CategoryFilter = "all" | "raid" | "dungeon";

interface RecentRaidsConfig {
  limit: number;
  category: CategoryFilter;
  hasVideo: "all" | "with";
}



function RecentRaidsContent({ config, position, guild }: GuildPanelRenderProps<RecentRaidsConfig>) {
  // Derive columns from panel grid width (1-12 columns)
  const cols = position.w >= 9 ? 3 : position.w >= 6 ? 2 : 1;
  const [instances, setInstances] = useState<RecentInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const limit = config.limit || 5;
  const category = config.category || "all";
  const hasVideo = config.hasVideo === "with";

  const fetchRecent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch extra to account for client-side category filtering
      const fetchLimit = category !== "all" ? limit * 4 : limit;
      const params = new URLSearchParams();
      params.set("limit", String(Math.min(fetchLimit, 100)));
      if (guild.id) params.set("guild_id", guild.id);
      if (hasVideo) params.set("has_video", "true");

      const response = await fetch(`/api/v1/raidlogs/recent?${params}`);
      if (!response.ok) throw new Error("Failed to fetch recent instances");
      const data = (await response.json()) as RecentInstancesResponse;
      setInstances(data.instances ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [guild.id, limit, category, hasVideo]);

  useEffect(() => {
    fetchRecent();
  }, [fetchRecent]);

  const filtered = useMemo(() => {
    let result = instances;
    if (category !== "all") {
      result = result.filter((inst) => getInstanceCategory(inst.name) === category);
    }
    return result.slice(0, limit);
  }, [instances, category, limit]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[100px]">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[100px] text-muted-foreground gap-2">
        <AlertCircle className="h-5 w-5" />
        <p className="text-xs">Failed to load recent instances</p>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[100px] text-muted-foreground">
        <p className="text-sm">No recent instances found</p>
      </div>
    );
  }

  return (
    <div
      className="grid gap-3 p-1"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {filtered.map((instance) => (
        <RaidCard key={instance.id} instance={instance} />
      ))}
    </div>
  );
}

export const RecentRaidsPanel: GuildPanelDefinition<RecentRaidsConfig> = {
  type: "recent_raids",
  label: "Recent",
  icon: <Calendar className="h-4 w-4" />,
  description: "Shows recent raid and dungeon instances with filtering",
  defaultSize: { w: 12, h: 4 },
  minSize: { w: 4, h: 2 },
  maxSize: { w: 12, h: 8 },
  configSchema: [
    {
      name: "limit",
      label: "Number of instances to show",
      type: "number",
      defaultValue: 6,
    },
    {
      name: "category",
      label: "Category",
      type: "select",
      options: [
        { value: "all", label: "All" },
        { value: "raid", label: "Raids Only" },
        { value: "dungeon", label: "Dungeons Only" },
      ],
      defaultValue: "all",
    },
    {
      name: "hasVideo",
      label: "Video",
      type: "select",
      options: [
        { value: "all", label: "All" },
        { value: "with", label: "With Video Only" },
      ],
      defaultValue: "all",
    },
  ],
  defaultConfig: {
    limit: 6,
    category: "all",
    hasVideo: "all",
  },
  render: (props) => <RecentRaidsContent {...props} />,
};
