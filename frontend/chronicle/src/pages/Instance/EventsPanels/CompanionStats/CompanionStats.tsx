/**
 * CompanionStats panel — Displays addon relay health as a bar chart.
 *
 * Shows the 10 per-minute buckets of landed message chunks from the
 * ChronicleCompanionWoTLK addon. Fetches and decodes the companion_stats
 * stream directly (self-managed aggregation, no worker).
 */

import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import type { PanelDefinition, PanelRenderProps } from "../types";
import { companionStatsProcessor, type CompanionStatsResult } from "./companionStats.processor";
import { useInstanceEventsContext } from "@/hooks/instanceEvents/InstanceEventsContext";
import { createStreamCursor } from "@/api/protodecode/decode";
import { CompanionStatsSchema } from "@/api/proto/chronicle_pb";

/** A single decoded CompanionStats snapshot. */
interface StatsSnapshot {
  offsetMilli: number;
  dirty: number;
  buckets: number[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createCompanionStatsPanel(): PanelDefinition<CompanionStatsResult, any> {
  return {
    ...companionStatsProcessor,
    label: "Addon Relay Stats",
    icon: <Radio className="h-4 w-4" />,
    selfManagesAggregation: true,
    supportsPerSecond: false,

    render: (props: PanelRenderProps<CompanionStatsResult>) => {
      return <CompanionStatsContent {...props} />;
    },
  };
}

function CompanionStatsContent({ context }: PanelRenderProps<CompanionStatsResult>) {
  const eventsCtx = useInstanceEventsContext();
  const [snapshots, setSnapshots] = useState<StatsSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const cached = await eventsCtx.fetchStream("companion_stats");
        if (cancelled || !cached) {
          setSnapshots([]);
          setLoading(false);
          return;
        }

        const cursor = createStreamCursor(CompanionStatsSchema, cached.data);
        const results: StatsSnapshot[] = [];

        // StreamCursor: peek()/advance() to read, nextEncounter() to move between encounters.
        // The first encounter is loaded by the constructor, so enter the read loop directly.
        do {
          while (cursor.hasMoreInEncounter) {
            const peeked = cursor.peek();
            if (!peeked) break;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const m = peeked.message as any;
            results.push({
              offsetMilli: m.meta?.offsetMilli ?? 0,
              dirty: Number(m.dirty ?? 0),
              buckets: Array.isArray(m.buckets) ? m.buckets.map(Number) : [],
            });
            cursor.advance();
          }
        } while (cursor.nextEncounter());

        if (!cancelled) {
          setSnapshots(results);
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [eventsCtx, context.instance.id]);

  if (loading) {
    return <div className="text-center py-4 text-muted-foreground text-sm">Loading addon stats…</div>;
  }
  if (error) {
    return <div className="text-center py-4 text-destructive text-sm">Error: {error}</div>;
  }
  if (snapshots.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground text-sm">
        No companion addon stats available.
        <br />
        <span className="text-xs">The ChronicleCompanionWoTLK addon emits relay stats every 5 minutes.</span>
      </div>
    );
  }

  return <BucketChart snapshots={snapshots} />;
}

/** Show the latest snapshot's buckets as a bar chart. */
function BucketChart({ snapshots }: { snapshots: StatsSnapshot[] }) {
  const latest = snapshots[snapshots.length - 1];
  const aggregated = latest.buckets.length > 0 ? latest.buckets : [];

  if (aggregated.length === 0) return null;

  const maxVal = Math.max(...aggregated, 1);
  const total = aggregated.reduce((a, b) => a + b, 0);

  // Labels: "now", "1m ago", ..., "9m ago"
  const labels = aggregated.map((_, i) => (i === 0 ? "now" : `${i}m`));

  return (
    <div className="px-3 py-2 space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Addon message chunks landed per minute</span>
        <div className="flex gap-3 font-mono">
          <span>{total} landed</span>
          <span className={latest.dirty > 0 ? "text-yellow-500" : ""}>{latest.dirty} pending</span>
        </div>
      </div>
      <div className="flex items-end gap-1" style={{ height: 120 }}>
        {aggregated.map((val, i) => {
          const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
              <span className="text-[10px] text-muted-foreground font-mono">{val}</span>
              <div
                className="w-full rounded-sm transition-all"
                style={{
                  height: `${Math.max(pct, 2)}%`,
                  backgroundColor: val > 0 ? "var(--color-chart-1)" : "var(--color-muted)",
                  opacity: val > 0 ? 1 : 0.3,
                }}
              />
              <span className="text-[9px] text-muted-foreground">{labels[i]}</span>
            </div>
          );
        })}
      </div>
      <div className="text-[10px] text-muted-foreground text-center">
        {snapshots.length} snapshot{snapshots.length !== 1 ? "s" : ""} recorded
      </div>
    </div>
  );
}
