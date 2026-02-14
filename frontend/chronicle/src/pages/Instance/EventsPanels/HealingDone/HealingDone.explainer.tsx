/**
 * Explainer content for the Healing Done panel.
 */

import type { PanelExplainer } from "../../PanelExplainer/types";

export const healingDoneExplainer: PanelExplainer = {
  summary:
    "Shows healing done by each healer. Effective healing restores HP, while overhealing is the 'overflow' when a heal exceeds the target's missing health. " +
    "High overhealing can indicate inefficient healing or just keeping the raid topped off.",

  tips: [
    "Toggle 'Per Second' to see HPS instead of total healing",
    "Click any row to see breakdown by spell and heal target",
    "Overhealing percentage helps identify wasted healing",
    "Select specific players in the Entity panel to compare healers",
    "You can open more than 1 breakout panel!",
    "Click 'Healed' in the breakout table to see heals by target instead of by spell",
  ],

  breakoutsOpen: 2,

  walkthrough: [
    {
      id: "view-mode-toggle",
      instruction: "Use these buttons to switch between Effective, Overheal, and Total healing views",
      waitFor: "hover",
      highlightSelector: "[data-healing-view-toggle]",
    },
    {
      id: "select-healer",
      instruction: "Click on a healer row to see their healing breakdown",
      waitFor: "click",
      highlightSelector: "[data-panel-row]",
    },
    {
      id: "view-breakout-panel",
      instruction: "This is the spell breakout - it shows which heals they used and their effectiveness",
      waitFor: "hover",
      highlightSelector: "[data-breakout-panel]",
    },
    {
      id: "click-more-detail",
      instruction: "Click 'More detail' to see hit type breakdowns (normal vs crit heals)",
      waitFor: "click",
      highlightSelector: "[data-more-detail]",
    },
    {
      id: "click-minmax",
      instruction: "Click the ↕ button to show min/avg/max values for each heal type",
      waitFor: "click",
      highlightSelector: "[data-minmax-toggle]",
    },
    {
      id: "toggle-hps",
      instruction: "Toggle 'Per Second' in the header to switch between total and HPS view",
      waitFor: "click",
      highlightSelector: "[data-per-second-toggle]",
    },
  ],
};
