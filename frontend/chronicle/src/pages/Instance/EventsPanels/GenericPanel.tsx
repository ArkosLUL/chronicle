import type { ReactNode } from "react";
import type { PanelRenderProps } from "./types";

export function GenericPanel<TResult>({
  loading,
  processing,
  error,
  children,
  totalEvents,
  perSecond,
  processingTimeMs,
  durationMs,

}: PanelRenderProps<TResult> & { children: ReactNode }) {
  if (loading) {
    return <div className="text-xs text-muted-foreground">Fetching data...</div>;
  }
  if (processing) {
    return <div className="text-xs text-muted-foreground">Processing...</div>;
  }
  if (error) {
    return <div className="text-xs text-destructive">Error: {error.message}</div>;
  }
  return <>
    {children}
    <div className="text-xs text-muted-foreground mb-2">
      {processingTimeMs !== null && (
        <span className="ml-2 text-blue-500">
          Processed in {processingTimeMs.toFixed(0)}ms
        </span>
      )}
    </div>
  </>;
}

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