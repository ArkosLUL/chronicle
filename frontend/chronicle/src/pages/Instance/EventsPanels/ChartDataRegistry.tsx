/**
 * ChartDataRegistry - Shared context for panels to publish their PlayerMetricChartData[].
 *
 * Split into two contexts to avoid cascading re-renders:
 *  - ActionsContext (register/unregister): stable, never triggers re-renders.
 *    Consumed by every EventsPanel to publish chart data.
 *  - EntriesContext (entries map): changes when data is registered/unregistered.
 *    Only consumed by ComparisonContent to read other panels' data.
 */

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { PlayerMetricChartData } from "@/components/ui/PlayerMetricChart/PlayerMetricChart";
import type { EventsPanelType } from "./EventsPanel";

export interface ChartDataEntry {
  /** Stable layout item ID (e.g. "panel-1"). Used as the map key. */
  panelId: string;
  /** Positional index in the current layout (0-based). Kept for display labels. */
  panelIndex: number;
  panelType: EventsPanelType;
  label: string;
  borderColor: string | null;
  data: PlayerMetricChartData[];
}

interface ChartDataActions {
  register: (entry: ChartDataEntry) => void;
  unregister: (panelId: string) => void;
}

// Write context — stable value, consumed by every panel.
const ChartDataActionsContext = createContext<ChartDataActions | null>(null);
// Read context — changes when entries change, only consumed by ComparisonContent.
const ChartDataEntriesContext = createContext<Map<string, ChartDataEntry>>(new Map());

export function ChartDataRegistryProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Map<string, ChartDataEntry>>(() => new Map());

  const register = useCallback((entry: ChartDataEntry) => {
    setEntries((prev) => {
      const existing = prev.get(entry.panelId);
      if (existing && existing.data === entry.data && existing.borderColor === entry.borderColor && existing.label === entry.label) {
        return prev;
      }
      const next = new Map(prev);
      next.set(entry.panelId, entry);
      return next;
    });
  }, []);

  const unregister = useCallback((panelId: string) => {
    setEntries((prev) => {
      if (!prev.has(panelId)) return prev;
      const next = new Map(prev);
      next.delete(panelId);
      return next;
    });
  }, []);

  // actions object is stable because register/unregister are stable useCallbacks.
  const [actions] = useState<ChartDataActions>(() => ({ register, unregister }));

  return (
    <ChartDataActionsContext.Provider value={actions}>
      <ChartDataEntriesContext.Provider value={entries}>
        {children}
      </ChartDataEntriesContext.Provider>
    </ChartDataActionsContext.Provider>
  );
}

/** No-op fallback when used outside a provider (Layout Lab, Storybook, etc.). */
const NOOP_ACTIONS: ChartDataActions = {
  register: () => {},
  unregister: () => {},
};

/**
 * Get register/unregister actions. Stable reference — will NOT cause
 * re-renders when other panels register data.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useChartDataActions(): ChartDataActions {
  return useContext(ChartDataActionsContext) ?? NOOP_ACTIONS;
}

/**
 * Read the entries map. Triggers re-renders when any panel registers data.
 * Only use this in components that need to read other panels' data (ComparisonContent).
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useChartDataEntries(): Map<string, ChartDataEntry> {
  return useContext(ChartDataEntriesContext);
}
