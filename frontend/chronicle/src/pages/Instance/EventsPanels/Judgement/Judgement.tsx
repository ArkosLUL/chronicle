/**
 * Judgement panel - Shows Paladin Judgement usage and uptime.
 * 
 * Paladins view: Shows each paladin's judgements by type
 * Targets view: Shows judgement uptime per target with benefit tracking
 */

import { useMemo, useState } from "react";
import { Scale } from "lucide-react";
import type { PanelDefinition, PanelRenderProps } from "../types";
import {
  judgementProcessor,
  type JudgementResult,
  type PaladinJudgementStats,
  type TargetJudgementStats,
  type JudgementType,
} from "./judgement.processor";
import { GenericPanel } from "../GenericPanel";
import { cn } from "@/lib/utils";

/** Display names for judgement types */
const JUDGEMENT_LABELS: Record<JudgementType, string> = {
  light: "Light",
  wisdom: "Wisdom",
  crusader: "Crusader",
  justice: "Justice",
  unknown: "Unknown",
};

/** Short codes for compact display */
const JUDGEMENT_SHORT: Record<JudgementType, string> = {
  light: "JoL",
  wisdom: "JoW",
  crusader: "JotC",
  justice: "JoJ",
  unknown: "?",
};

/** Colors for judgement types */
const JUDGEMENT_COLORS: Record<JudgementType, string> = {
  light: "text-yellow-400",
  wisdom: "text-blue-400",
  crusader: "text-red-400",
  justice: "text-purple-400",
  unknown: "text-gray-400",
};

/**
 * Format milliseconds to human-readable duration
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
}

/**
 * Format uptime as percentage
 */
function formatUptimePercent(uptimeMs: number, totalMs: number): string {
  if (totalMs <= 0) return "0%";
  const percent = (uptimeMs / totalMs) * 100;
  return `${percent.toFixed(1)}%`;
}

/**
 * Format large numbers with K suffix
 */
function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

/**
 * Sort paladins by total judgements descending
 */
function sortedPaladins(paladins: Record<string, PaladinJudgementStats>): PaladinJudgementStats[] {
  return Object.values(paladins).sort((a, b) => b.totalJudgements - a.totalJudgements);
}

/**
 * Sort targets by total uptime descending
 */
function sortedTargets(targets: Record<string, TargetJudgementStats>): TargetJudgementStats[] {
  return Object.values(targets).sort((a, b) => b.totalUptimeMs - a.totalUptimeMs);
}

/**
 * Create the Judgement panel definition.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createJudgementPanel(): PanelDefinition<JudgementResult, any> {
  return {
    ...judgementProcessor,
    label: "Judgement",
    icon: <Scale className="h-4 w-4" />,
    supportsPerSecond: false,
    checkboxLabel: "Show paladins",

    render: (props: PanelRenderProps<JudgementResult>) => {
      return <JudgementContent {...props} />;
    },
  };
}

function JudgementContent(props: PanelRenderProps<JudgementResult>) {
  const { result, checkboxChecked: showPaladins, durationMs } = props;

  const paladins = useMemo(() => {
    if (!result) return [];
    return sortedPaladins(result.paladins);
  }, [result]);

  const targets = useMemo(() => {
    if (!result) return [];
    return sortedTargets(result.targets);
  }, [result]);

  const hasData = paladins.length > 0 || targets.length > 0;

  return (
    <GenericPanel {...props}>
      {!hasData ? (
        <div className="text-center py-2 text-muted-foreground text-sm">
          No Judgement casts found
        </div>
      ) : showPaladins ? (
        <PaladinsView paladins={paladins} />
      ) : (
        <TargetsView targets={targets} durationMs={durationMs} jolBenefit={result?.jolBenefit} />
      )}
    </GenericPanel>
  );
}

interface PaladinsViewProps {
  paladins: PaladinJudgementStats[];
}

function PaladinsView({ paladins }: PaladinsViewProps) {
  return (
    <div className="space-y-2">
      <div className="max-h-[300px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card">
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left py-1.5 px-2 font-medium">Paladin</th>
              <th className="text-center py-1.5 px-2 font-medium">
                <span className={JUDGEMENT_COLORS.light} title="Judgement of Light">JoL</span>
              </th>
              <th className="text-center py-1.5 px-2 font-medium">
                <span className={JUDGEMENT_COLORS.wisdom} title="Judgement of Wisdom">JoW</span>
              </th>
              <th className="text-center py-1.5 px-2 font-medium">
                <span className={JUDGEMENT_COLORS.crusader} title="Judgement of the Crusader">JotC</span>
              </th>
              <th className="text-right py-1.5 px-2 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {paladins.map((paladin) => (
              <tr
                key={paladin.guid}
                className="border-b border-border/10 hover:bg-muted/50"
              >
                <td className="py-1 px-2">
                  <span className="font-medium text-[var(--class-paladin)]">
                    {paladin.name}
                  </span>
                </td>
                <td className={cn("py-1 px-2 text-center font-mono", paladin.byType.light > 0 && JUDGEMENT_COLORS.light)}>
                  {paladin.byType.light || "—"}
                </td>
                <td className={cn("py-1 px-2 text-center font-mono", paladin.byType.wisdom > 0 && JUDGEMENT_COLORS.wisdom)}>
                  {paladin.byType.wisdom || "—"}
                </td>
                <td className={cn("py-1 px-2 text-center font-mono", paladin.byType.crusader > 0 && JUDGEMENT_COLORS.crusader)}>
                  {paladin.byType.crusader || "—"}
                </td>
                <td className="py-1 px-2 text-right font-mono">
                  {paladin.totalJudgements}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface TargetsViewProps {
  targets: TargetJudgementStats[];
  durationMs: number;
  jolBenefit?: { totalHealing: number; byPlayer: Map<string, number> };
}

function TargetsView({ targets, durationMs, jolBenefit }: TargetsViewProps) {
  const [selectedTargetGuid, setSelectedTargetGuid] = useState<string | null>(null);

  const selectedTarget = selectedTargetGuid
    ? targets.find((t) => t.guid === selectedTargetGuid)
    : null;

  return (
    <div className="space-y-2">
      {/* JoL Benefit Summary */}
      {jolBenefit && jolBenefit.totalHealing > 0 && (
        <div className="text-xs bg-yellow-500/10 border border-yellow-500/20 rounded px-2 py-1">
          <span className={JUDGEMENT_COLORS.light}>Judgement of Light</span>
          {" healed for "}
          <span className="font-medium text-green-400">{formatNumber(jolBenefit.totalHealing)}</span>
          {" total"}
        </div>
      )}

      {selectedTarget ? (
        <TargetBreakout
          target={selectedTarget}
          durationMs={durationMs}
          onClose={() => setSelectedTargetGuid(null)}
        />
      ) : (
        <>
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{targets.length}</span> targets with judgements
            {selectedTarget && (
              <button
                type="button"
                onClick={() => setSelectedTargetGuid(null)}
                className="ml-2 text-blue-400 hover:text-blue-300 cursor-pointer"
              >
                [clear selection]
              </button>
            )}
          </div>

          <div className="max-h-[300px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-1.5 px-2 font-medium">Target</th>
                  <th className="text-center py-1.5 px-2 font-medium">
                    <span className={JUDGEMENT_COLORS.light} title="Judgement of Light uptime">JoL</span>
                  </th>
                  <th className="text-center py-1.5 px-2 font-medium">
                    <span className={JUDGEMENT_COLORS.wisdom} title="Judgement of Wisdom uptime">JoW</span>
                  </th>
                  <th className="text-center py-1.5 px-2 font-medium">
                    <span className={JUDGEMENT_COLORS.crusader} title="Judgement of the Crusader uptime">JotC</span>
                  </th>
                  <th className="text-right py-1.5 px-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {targets.map((target) => (
                  <tr
                    key={target.guid}
                    className="border-b border-border/10 hover:bg-muted/50 cursor-pointer"
                    onClick={() => setSelectedTargetGuid(target.guid)}
                  >
                    <td className="py-1 px-2 font-medium text-orange-400 whitespace-nowrap">
                      {target.name}
                    </td>
                    <td className={cn("py-1 px-2 text-center font-mono text-2xs", target.uptimeByType.light > 0 && JUDGEMENT_COLORS.light)}>
                      {target.uptimeByType.light > 0
                        ? formatUptimePercent(target.uptimeByType.light, durationMs)
                        : "—"}
                    </td>
                    <td className={cn("py-1 px-2 text-center font-mono text-2xs", target.uptimeByType.wisdom > 0 && JUDGEMENT_COLORS.wisdom)}>
                      {target.uptimeByType.wisdom > 0
                        ? formatUptimePercent(target.uptimeByType.wisdom, durationMs)
                        : "—"}
                    </td>
                    <td className={cn("py-1 px-2 text-center font-mono text-2xs", target.uptimeByType.crusader > 0 && JUDGEMENT_COLORS.crusader)}>
                      {target.uptimeByType.crusader > 0
                        ? formatUptimePercent(target.uptimeByType.crusader, durationMs)
                        : "—"}
                    </td>
                    <td className="py-1 px-2 text-right font-mono text-2xs whitespace-nowrap">
                      {formatDuration(target.totalUptimeMs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

interface TargetBreakoutProps {
  target: TargetJudgementStats;
  durationMs: number;
  onClose: () => void;
}

function TargetBreakout({ target, durationMs, onClose }: TargetBreakoutProps) {
  // Sort applications by start time
  const sortedApps = useMemo(() => {
    return [...target.applications].sort((a, b) => a.startOffsetMs - b.startOffsetMs);
  }, [target.applications]);

  // Group by type for summary
  const byType = useMemo(() => {
    const result: Record<JudgementType, { count: number; totalMs: number; paladins: Set<string> }> = {
      light: { count: 0, totalMs: 0, paladins: new Set() },
      wisdom: { count: 0, totalMs: 0, paladins: new Set() },
      crusader: { count: 0, totalMs: 0, paladins: new Set() },
      justice: { count: 0, totalMs: 0, paladins: new Set() },
      unknown: { count: 0, totalMs: 0, paladins: new Set() },
    };
    for (const app of sortedApps) {
      const duration = app.endOffsetMs !== null
        ? app.endOffsetMs - app.startOffsetMs
        : 0; // Still active - we don't know duration
      result[app.type].count++;
      result[app.type].totalMs += duration;
      if (app.casterName !== "Unknown") {
        result[app.type].paladins.add(app.casterName);
      }
    }
    return result;
  }, [sortedApps]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-orange-400">{target.name}</span>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
        >
          ✕ close
        </button>
      </div>

      {/* Type summary */}
      <div className="space-y-1">
        {(["light", "wisdom", "crusader", "justice"] as JudgementType[]).map((type) => {
          const stats = byType[type];
          if (stats.count === 0) return null;
          return (
            <div key={type} className="text-2xs flex items-center gap-2">
              <span className={cn("font-medium", JUDGEMENT_COLORS[type])}>
                {JUDGEMENT_LABELS[type]}
              </span>
              <span className="text-muted-foreground">
                {stats.count} applications
                {" • "}
                {formatUptimePercent(stats.totalMs, durationMs)} uptime
                {stats.paladins.size > 0 && (
                  <>
                    {" • "}
                    <span className="text-[var(--class-paladin)]">
                      {Array.from(stats.paladins).join(", ")}
                    </span>
                  </>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* Timeline */}
      <div className="max-h-[200px] overflow-y-auto">
        <table className="w-full text-2xs font-mono">
          <thead className="sticky top-0 bg-card">
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left py-1 px-2 font-medium">Type</th>
              <th className="text-left py-1 px-2 font-medium">Paladin</th>
              <th className="text-right py-1 px-2 font-medium">Start</th>
              <th className="text-right py-1 px-2 font-medium">Duration</th>
            </tr>
          </thead>
          <tbody>
            {sortedApps.map((app, index) => {
              const duration = app.endOffsetMs !== null
                ? app.endOffsetMs - app.startOffsetMs
                : null;
              return (
                <tr
                  key={index}
                  className="border-b border-border/10"
                >
                  <td className={cn("py-0.5 px-2", JUDGEMENT_COLORS[app.type])}>
                    {JUDGEMENT_SHORT[app.type]}
                  </td>
                  <td className="py-0.5 px-2 text-[var(--class-paladin)]">
                    {app.casterName}
                  </td>
                  <td className="py-0.5 px-2 text-right">
                    {formatDuration(app.startOffsetMs)}
                  </td>
                  <td className="py-0.5 px-2 text-right">
                    {duration !== null ? formatDuration(duration) : "active"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
