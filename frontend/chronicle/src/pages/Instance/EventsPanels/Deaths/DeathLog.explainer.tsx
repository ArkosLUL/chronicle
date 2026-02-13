/**
 * Explainer content for the Death Log panel.
 */

import type { PanelExplainer } from "../../PanelExplainer/types";

export const deathLogExplainer: PanelExplainer = {
  summary:
    "A detailed timeline of every death, showing the events leading up to each one. " +
    "Essential for understanding what went wrong and preventing future deaths.",

  tips: [
    "Click a death row to expand and see the damage timeline",
    "Overkill damage is highlighted in red",
    "The timeline shows damage taken in the seconds before death",
    "Use this to identify if deaths were avoidable or due to specific mechanics",
    "Filter by selecting specific players to focus on their deaths",
  ],

  breakoutsOpen: 0, // Death log doesn't use standard breakouts

  walkthrough: [
    {
      id: "expand-death",
      instruction: "Click on a death row to expand the damage timeline",
      waitFor: "click",
      highlightSelector: "[data-death-row]",
    },
    {
      id: "examine-timeline",
      instruction:
        "Scroll through the events to see what damage killed them. " +
        "Look for large hits or rapid damage spikes.",
      waitFor: "scroll",
    },
    {
      id: "identify-killer",
      instruction:
        "The killer ability and source are shown - use this to understand the mechanic",
      waitFor: "manual",
    },
  ],
};
