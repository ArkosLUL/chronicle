import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import type { RecentInstance, RecentInstancesResponse } from "@/api/typesGenerated";
import { getInstanceCategory, getInstanceBackground, getInstanceAbbrev } from "@/pages/Logs/utils/instanceImages";
import { LogsCalendar } from "@/pages/Logs/components/LogsCalendar";
import type { GuildPanelDefinition, GuildPanelRenderProps } from "./types";

type CategoryFilter = "all" | "raid" | "dungeon";

interface CalendarConfig {
  category: CategoryFilter;
  hasVideo: "all" | "with";
}


// Group instances by date key (yyyy-MM-dd)
function groupByDate(instances: RecentInstance[]): Record<string, RecentInstance[]> {
  const result: Record<string, RecentInstance[]> = {};
  for (const inst of instances) {
    const date = inst.first_encounter_time || inst.uploaded_at;
    if (!date) continue;
    const key = format(new Date(date), "yyyy-MM-dd");
    if (!result[key]) result[key] = [];
    result[key].push(inst);
  }
  return result;
}

// Compact card for a single instance inside a calendar day cell
function InstanceDayCard({ instance }: { instance: RecentInstance }) {
  const [imageError, setImageError] = useState(false);
  const backgroundImage = getInstanceBackground(instance.name);
  const abbrev = getInstanceAbbrev(instance.name);
  const instanceUrl = instance.slug
    ? `/instances/${instance.slug}`
    : `/instances/${instance.id}`;

  return (
    <Link to={instanceUrl} className="block">
      <div className="relative h-8 sm:h-10 rounded overflow-hidden group cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-800" />
        {!imageError && (
          <img
            src={backgroundImage}
            alt=""
            onError={() => setImageError(true)}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            style={{ objectPosition: "center 35%" }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/40" />
        <div className="relative z-10 h-full flex items-center px-1.5">
          <span className="text-[10px] sm:text-xs font-medium text-white truncate drop-shadow-lg group-hover:text-amber-300 transition-colors">
            <span className="sm:hidden">{abbrev}</span>
            <span className="hidden sm:inline">{instance.name}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

function ExpandableDayCell({ instances }: { instances: RecentInstance[] }) {
  const [expanded, setExpanded] = useState(false);
  const MAX_SHOWN = 3;

  if (instances.length === 0) return null;

  const shown = expanded ? instances : instances.slice(0, MAX_SHOWN);
  const remaining = instances.length - MAX_SHOWN;

  return (
    <>
      {shown.map((inst) => (
        <InstanceDayCard key={inst.id} instance={inst} />
      ))}
      {instances.length > MAX_SHOWN && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-[10px] text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted px-1.5 py-1 rounded text-center transition-colors flex items-center justify-center gap-0.5"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              +{remaining} more
            </>
          )}
        </button>
      )}
    </>
  );
}

function CalendarContent({ config, guild }: GuildPanelRenderProps<CalendarConfig>) {
  const [month, setMonth] = useState(() => new Date());
  const [instances, setInstances] = useState<RecentInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const category = config.category || "all";
  const hasVideo = config.hasVideo === "with";

  const fetchInstances = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("start", startOfMonth(month).toISOString());
      params.set("end", endOfMonth(month).toISOString());
      if (guild.id) params.set("guild_id", guild.id);
      if (hasVideo) params.set("has_video", "true");

      const response = await fetch(`/api/v1/raidlogs/range?${params}`);
      if (!response.ok) throw new Error("Failed to fetch instances");
      const data = (await response.json()) as RecentInstancesResponse;
      setInstances([...(data.instances ?? [])]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [guild.id, hasVideo, month]);

  useEffect(() => {
    fetchInstances();
  }, [fetchInstances]);

  const filtered = useMemo(() => {
    if (category === "all") return instances;
    return instances.filter((inst) => getInstanceCategory(inst.name) === category);
  }, [instances, category]);

  const byDate = useMemo(() => groupByDate(filtered), [filtered]);

  const dayContent = useCallback(
    (date: Date) => {
      const key = format(date, "yyyy-MM-dd");
      const dayInstances = byDate[key];
      if (!dayInstances || dayInstances.length === 0) return null;

      return <ExpandableDayCell instances={dayInstances} />;
    },
    [byDate]
  );

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
        <p className="text-xs">Failed to load instances</p>
      </div>
    );
  }

  return (
    <div className="p-1">
      <LogsCalendar
        month={month}
        onMonthChange={setMonth}
        dayContent={dayContent}
      />
    </div>
  );
}

export const CalendarPanel: GuildPanelDefinition<CalendarConfig> = {
  type: "calendar",
  label: "Calendar",
  icon: <CalendarDays className="h-4 w-4" />,
  description: "Monthly calendar view of raid activity",
  defaultSize: { w: 12, h: 6 },
  minSize: { w: 6, h: 4 },
  maxSize: { w: 12, h: 10 },
  configSchema: [
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
    category: "all",
    hasVideo: "all",
  },
  render: (props) => <CalendarContent {...props} />,
};
