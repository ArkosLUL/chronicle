/**
 * Shared component for rendering entity-value lists
 */

import type { PanelRenderProps, EntityValueMap } from "./types";

function formatNumber(value: number): string {
  if (!value) return "0";
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toFixed(0);
}

export interface EntityValueListProps extends PanelRenderProps<EntityValueMap> {
  valueLabel: string;
}

export function EntityValueList({
  result,
  totalEvents,
  processingTimeMs,
  durationMs,
  perSecond,
  loading,
  processing,
  error,
  valueLabel,
}: EntityValueListProps) {
  // Sort entries by value descending
  const sortedEntries = Array.from(result.entries())
    .sort((a, b) => b[1] - a[1]);
  
  const totalValue = sortedEntries.reduce((sum, [, value]) => sum + value, 0);
  const displayTotal = perSecond && durationMs > 0
    ? formatNumber(totalValue / durationMs * 1000)
    : formatNumber(totalValue);

  if (loading) {
    return <div className="text-xs text-muted-foreground">Fetching data...</div>;
  }

  if (processing) {
    return <div className="text-xs text-muted-foreground">Processing...</div>;
  }

  if (error) {
    return <div className="text-xs text-destructive">Error: {error.message}</div>;
  }

  return (
    <div>
      <div className="text-xs text-muted-foreground mb-2">
        Total {valueLabel}: <span className="font-medium text-foreground">{displayTotal}{perSecond ? "/s" : ""}</span>
        <span className="ml-2">({sortedEntries.length} entities, {formatNumber(totalEvents)} events)</span>
        {processingTimeMs !== null && (
          <span className="ml-2 text-blue-500">
            Processed in {processingTimeMs.toFixed(0)}ms
          </span>
        )}
      </div>
      
      {/* Simple list display - can be replaced with chart later */}
      <div className="max-h-64 overflow-y-auto space-y-1">
        {sortedEntries.slice(0, 20).map(([id, value]) => {
          const displayValue = perSecond && durationMs > 0
            ? formatNumber(value / durationMs * 1000)
            : formatNumber(value);
          const percent = totalValue > 0 ? (value / totalValue) * 100 : 0;
          
          return (
            <div key={id} className="flex items-center gap-2 text-xs">
              <div className="flex-1 truncate" title={id}>
                {id}
              </div>
              <div className="w-24 bg-muted rounded-full h-1.5">
                <div
                  className="bg-primary h-1.5 rounded-full"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <div className="w-16 text-right font-mono">
                {displayValue}{perSecond ? "/s" : ""}
              </div>
            </div>
          );
        })}
        {sortedEntries.length > 20 && (
          <div className="text-xs text-muted-foreground">
            ...and {sortedEntries.length - 20} more
          </div>
        )}
      </div>
    </div>
  );
}
