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
    "You can open more than 1 breakout panel!",
    "Click 'Bt Target' to see the damage breakdown by target instead of by ability",
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
      id: "view-breakout-panel",
      instruction: "This is the ability breakout - it shows which spells contributed to their damage (hover over it to advance!)",
      waitFor: "hover",
      highlightSelector: "[data-breakout-panel]",
    },
    {
      id: "click-more-detail",
      instruction: "Click 'More detail' to see hit type breakdowns (normal, crit, glancing, etc.)",
      waitFor: "click",
      highlightSelector: "[data-more-detail]",
    },
    {
      id: "click-minmax",
      instruction: "Click the ↕ button to show min/avg/max values for each hit type",
      waitFor: "click",
      highlightSelector: "[data-minmax-toggle]",
    },
    {
      id: "toggle-dps",
      instruction: "Toggle 'Per Second' in the header to switch between total and DPS view",
      waitFor: "click",
      highlightSelector: "[data-per-second-toggle]",
    },
  ],
};
