/**
 * Explainer content for the Healing Done panel.
 */

import type { PanelExplainer } from "../../PanelExplainer/types";

export const healingDoneExplainer: PanelExplainer = {
  summary:
    "Shows total effective healing done by each healer. " +
    "Overhealing is tracked but not included in the main totals.",

  tips: [
    "Toggle 'Per Second' to see HPS instead of total healing",
    "Click any row to see breakdown by spell and heal target",
    "Overhealing percentage helps identify wasted healing",
    "Select specific players in the Entity panel to compare healers",
    "The 'Effective' column shows healing that wasn't overhealing",
  ],

  breakoutsOpen: 2,

  walkthrough: [
    {
      id: "select-healer",
      instruction: "Click on a healer row to see their healing breakdown",
      waitFor: "click",
      highlightSelector: "[data-panel-row]",
    },
    {
      id: "view-spell-breakout",
      instruction:
        "The spell breakout shows which heals they used and their effectiveness",
      waitFor: "manual",
    },
    {
      id: "check-overheal",
      instruction:
        "Look at the overheal % to identify if healing was being wasted",
      waitFor: "manual",
    },
  ],
};
