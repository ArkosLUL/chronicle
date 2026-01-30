/**
 * PanelTimingContext - Tracks how long it takes for all panels to finish loading.
 * 
 * Usage:
 * 1. Wrap panels in <PanelTimingProvider panelCount={4}>
 * 2. Each panel calls usePanelTiming() and reports when done
 * 3. Use <PanelTimingDisplay /> to show the total time
 */

import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react";

interface PanelTimingContextValue {
  /** Report that a panel has finished loading */
  reportPanelDone: (panelId: string) => void;
  /** Reset timing (call when encounter selection changes) */
  resetTiming: () => void;
  /** Total time from first panel start to last panel done (ms) */
  totalTimeMs: number | null;
  /** Number of panels that have reported done */
  doneCount: number;
  /** Total number of panels expected */
  panelCount: number;
  /** Whether all panels are done */
  allDone: boolean;
}

const PanelTimingContext = createContext<PanelTimingContextValue | null>(null);

interface PanelTimingProviderProps {
  children: ReactNode;
  panelCount: number;
}

export function PanelTimingProvider({ children, panelCount }: PanelTimingProviderProps) {
  const [totalTimeMs, setTotalTimeMs] = useState<number | null>(null);
  const [doneCount, setDoneCount] = useState(0);
  
  // Start timer immediately on first render
  const startTimeRef = useRef<number>(performance.now());
  const donePanelsRef = useRef<Set<string>>(new Set());
  
  const resetTiming = useCallback(() => {
    // Start timer immediately when reset is called (i.e., when encounters change)
    startTimeRef.current = performance.now();
    donePanelsRef.current.clear();
    setDoneCount(0);
    setTotalTimeMs(null);
  }, []);
  
  const reportPanelDone = useCallback((panelId: string) => {
    // Skip if already reported
    if (donePanelsRef.current.has(panelId)) return;
    
    donePanelsRef.current.add(panelId);
    const newCount = donePanelsRef.current.size;
    setDoneCount(newCount);
    
    // When all panels done, record total time
    if (newCount >= panelCount) {
      const elapsed = performance.now() - startTimeRef.current;
      setTotalTimeMs(elapsed);
    }
  }, [panelCount]);
  
  const value: PanelTimingContextValue = {
    reportPanelDone,
    resetTiming,
    totalTimeMs,
    doneCount,
    panelCount,
    allDone: doneCount >= panelCount,
  };
  
  return (
    <PanelTimingContext.Provider value={value}>
      {children}
    </PanelTimingContext.Provider>
  );
}

export function usePanelTimingContext(): PanelTimingContextValue | null {
  return useContext(PanelTimingContext);
}

/**
 * Hook for panels to report their timing.
 * Call with a stable panelId.
 */
export function usePanelTiming(panelId: string, isDone: boolean): void {
  const ctx = usePanelTimingContext();
  
  useEffect(() => {
    if (isDone && ctx) {
      ctx.reportPanelDone(panelId);
    }
  }, [isDone, panelId, ctx]);
}

/**
 * Display component showing panel loading time.
 */
export function PanelTimingDisplay() {
  const ctx = usePanelTimingContext();
  
  if (!ctx) return null;
  
  const { totalTimeMs, doneCount, panelCount, allDone } = ctx;
  
  return (
    <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-md font-mono">
      {allDone ? (
        <span>
          All {panelCount} panels loaded in{" "}
          <span className="text-foreground font-semibold">
            {totalTimeMs?.toFixed(0)}ms
          </span>
        </span>
      ) : (
        <span>
          Loading panels... {doneCount}/{panelCount}
        </span>
      )}
    </div>
  );
}

/**
 * Component that resets timing when encounters change.
 * Render this inside PanelTimingProvider.
 */
export function PanelTimingResetter({ encounters }: { encounters: unknown[] }) {
  const ctx = usePanelTimingContext();
  
  // Create a stable key from encounters
  const encounterKey = JSON.stringify(encounters.map((e: unknown) => (e as { id: string }).id));
  
  useEffect(() => {
    ctx?.resetTiming();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset when encounters change, not on ctx changes
  }, [encounterKey]);
  
  return null;
}
