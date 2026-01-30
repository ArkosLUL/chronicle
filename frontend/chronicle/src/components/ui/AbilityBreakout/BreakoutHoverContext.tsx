/**
 * Context for synchronizing hover state across multiple breakout tables.
 * When hovering over a cell, highlights the row and column across all tables.
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export interface BreakoutHoverState {
  /** The hovered row identifier (ability name or target name) */
  rowId: string | null;
  /** The hovered column header (e.g., "Damage", "Crit%", "%") */
  columnId: string | null;
}

interface BreakoutHoverContextValue {
  hover: BreakoutHoverState;
  setHover: (state: BreakoutHoverState) => void;
  clearHover: () => void;
}

const BreakoutHoverContext = createContext<BreakoutHoverContextValue | null>(null);

export function BreakoutHoverProvider({ children }: { children: ReactNode }) {
  const [hover, setHoverState] = useState<BreakoutHoverState>({ rowId: null, columnId: null });

  const setHover = useCallback((state: BreakoutHoverState) => {
    setHoverState(state);
  }, []);

  const clearHover = useCallback(() => {
    setHoverState({ rowId: null, columnId: null });
  }, []);

  return (
    <BreakoutHoverContext.Provider value={{ hover, setHover, clearHover }}>
      {children}
    </BreakoutHoverContext.Provider>
  );
}

export function useBreakoutHover() {
  const context = useContext(BreakoutHoverContext);
  // Return a no-op context if not within a provider (tables work standalone)
  if (!context) {
    return {
      hover: { rowId: null, columnId: null },
      setHover: () => {},
      clearHover: () => {},
    };
  }
  return context;
}

/**
 * Helper to determine cell highlight state based on hover context.
 */
export function getCellHighlight(
  hover: BreakoutHoverState,
  rowId: string,
  columnId: string
): 'none' | 'row' | 'column' | 'intersection' {
  const rowMatch = hover.rowId === rowId;
  const colMatch = hover.columnId === columnId;

  if (rowMatch && colMatch) return 'intersection';
  if (rowMatch) return 'row';
  if (colMatch) return 'column';
  return 'none';
}
