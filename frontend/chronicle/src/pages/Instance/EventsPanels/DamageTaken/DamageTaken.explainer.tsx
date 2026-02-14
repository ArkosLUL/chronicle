/**
 * Explainer content for the Damage Taken panel.
 */

import type { PanelExplainer } from "../../PanelExplainer/types";

export const damageTakenExplainer: PanelExplainer = {
  summary:
    "Shows total damage taken by each player (or enemy). " +
    "Useful for identifying who's taking the most damage and from what sources. " +
    "Tanks will naturally be high - focus on unexpected damage to DPS/healers.",

  tips: [
    "Toggle 'Per Second' to see DTPS (damage taken per second)",
    "Click any row to see breakdown by ability and source",
    "High damage taken doesn't always mean bad play - tanks will naturally be high",
    "Compare damage taken across attempts to identify improvement areas",
    "Select specific enemies to see damage from only those sources",
  ],

  breakoutsOpen: 2,

  walkthrough: [
    {
      id: "select-player",
      instruction: "Click on a player row to see their damage taken breakdown",
      waitFor: "click",
      highlightSelector: "[data-panel-row]",
    },
    {
      id: "view-breakout-panel",
      instruction: "This breakout shows which abilities hit them and how much damage each dealt",
      waitFor: "hover",
      highlightSelector: "[data-breakout-panel]",
    },
    {
      id: "click-more-detail",
      instruction: "Click 'More detail' to see hit type breakdowns (normal, crit, blocked, etc.)",
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
      id: "toggle-dtps",
      instruction: "Toggle 'Per Second' in the header to switch between total and DTPS view",
      waitFor: "click",
      highlightSelector: "[data-per-second-toggle]",
    },
  ],
};
