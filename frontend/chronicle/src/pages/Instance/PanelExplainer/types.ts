/**
 * Type definitions for Panel Explainer feature.
 * 
 * Each panel can optionally define an explainer that provides:
 * - Summary description of what the panel shows
 * - Tips for using the panel effectively
 * - Interactive walkthrough steps (optional)
 */

import type { ReactNode } from "react";

/**
 * A single step in an interactive walkthrough.
 */
export interface ExplainerStep {
  /** Unique identifier for this step */
  id: string;
  
  /** Instruction text shown to the user */
  instruction: string;
  
  /** CSS selector to highlight (optional) */
  highlightSelector?: string;
  
  /** What user action completes this step */
  waitFor?: "click" | "hover" | "manual";
  
  /** Custom validation function (optional) */
  validate?: () => boolean;
}

/**
 * Panel explainer configuration.
 * 
 * TState is optional custom state for complex walkthroughs.
 */
export interface PanelExplainer<TState = unknown> {
  /** Short description of what this panel shows */
  summary: string;
  
  /** Tips for using this panel effectively */
  tips: string[];
  
  /** Number of breakout panels to force open (0, 1, or 2) */
  breakoutsOpen: number;
  
  /** Optional interactive walkthrough steps */
  walkthrough?: ExplainerStep[];
  
  /** Optional hook for custom explainer state */
  useExplainerState?: () => TState;
  
  /** Optional custom content renderer */
  renderCustomContent?: (state: TState) => ReactNode;
}

/**
 * Props passed to the explainer view.
 */
export interface PanelExplainerViewProps {
  /** The panel type being explained */
  panelType: string;
  
  /** Callback to exit explainer mode */
  onExit: () => void;
}
