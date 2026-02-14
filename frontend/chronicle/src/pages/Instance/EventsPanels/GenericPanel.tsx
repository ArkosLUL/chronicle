import type { ReactNode } from "react";
import type { PanelRenderProps } from "./types";
import { formatNumber } from "@/lib/format";

export function GenericPanel<TResult>({
  loading,
  processing,
  error,
  children,
  totalEvents,
  processingTimeMs,

}: PanelRenderProps<TResult> & { children: ReactNode }) {
  if (loading) {
    return <div className="text-xs text-muted-foreground min-h-panel flex items-center justify-center">Fetching data...</div>;
  }
  if (processing) {
    return <div className="text-xs text-muted-foreground min-h-panel flex items-center justify-center">Processing...</div>;
  }
  if (error) {
    return <div className="text-xs text-destructive min-h-panel flex items-center justify-center">Error: {error.message}</div>;
  }
  const eventsPerSecond = processingTimeMs ? (totalEvents / (processingTimeMs / 1000)) : 0;

  return <>
    {children}
    <div className="text-2xs mt-1 font-mono text-muted-foreground flex items-center justify-between" data-chromatic="ignore">
      <span>
        {formatNumber(totalEvents)} events
        {eventsPerSecond > 0 && (
          <span className="ml-2">({formatNumber(eventsPerSecond)}/s)</span>
        )}
      </span>
      {processingTimeMs !== null && (
        <span className="text-blue-500 mr-2">
          {processingTimeMs.toFixed(0)}ms
        </span>
      )}
    </div>
  </>;
}
