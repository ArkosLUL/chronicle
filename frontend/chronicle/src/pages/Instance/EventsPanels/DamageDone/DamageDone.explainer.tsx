/**
 * Explainer content for the Damage Done panel.
 */

import type { PanelExplainer } from "../../PanelExplainer/types";

export const damageDoneExplainer: PanelExplainer = {
  summary:
    "Shows total damage dealt by each player (or enemy) during the selected encounters. " +
    "Useful for comparing DPS performance and identifying top contributors.",

  tips: [
    "Toggle 'Per Second' to see DPS instead of total damage",
    "Click any row to see breakdown by ability and target",
    "Select specific enemies in the Entity panel to see damage only to those targets",
    "Multi-select encounters (Ctrl/Cmd+click) to see combined totals",
    "Hover over the crit % to see detailed crit statistics",
  ],

  breakoutsOpen: 2, // Show both ability AND target breakouts

  walkthrough: [
    {
      id: "select-player",
      instruction: "Click on a player row to see their damage breakdown",
      waitFor: "click",
      highlightSelector: "[data-panel-row]",
    },
    {
      id: "view-ability-breakout",
      instruction:
        "The ability breakout shows which spells contributed to their damage",
      waitFor: "manual",
    },
    {
      id: "view-target-breakout",
      instruction: "The target breakout shows which enemies they hit",
      waitFor: "manual",
    },
    {
      id: "toggle-dps",
      instruction:
        "Toggle 'Per Second' in the header to switch between total and DPS view",
      waitFor: "click",
      highlightSelector: "[data-per-second-toggle]",
    },
  ],
};
