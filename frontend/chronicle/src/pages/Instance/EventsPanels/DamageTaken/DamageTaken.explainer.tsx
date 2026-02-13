/**
 * Explainer content for the Damage Taken panel.
 */

import type { PanelExplainer } from "../../PanelExplainer/types";

export const damageTakenExplainer: PanelExplainer = {
  summary:
    "Shows total damage taken by each player (or enemy). " +
    "Useful for identifying who's taking the most damage and from what sources.",

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
      id: "view-ability-breakout",
      instruction:
        "The ability breakout shows which attacks hit them most",
      waitFor: "manual",
    },
    {
      id: "view-source-breakout",
      instruction:
        "The source breakout shows which enemies dealt damage to them",
      waitFor: "manual",
    },
  ],
};
