/**
 * Explainer content for the Roles panel.
 */

import type { PanelExplainer } from "../../PanelExplainer/types";

export const rolesExplainer: PanelExplainer = {
  summary:
    "Automatically detects and displays player roles (Tank, Healer, DPS) based on their actions. " +
    "Shows role distribution and helps verify raid composition.",

  tips: [
    "Roles are detected from actual combat behavior, not class",
    "A Warrior healing will show as Healer if they healed more than damaged",
    "Use this to quickly verify your raid has the right role balance",
    "Click a role group to see which players were assigned that role",
    "Hybrid classes may show different roles on different fights",
  ],

  breakoutsOpen: 0, // Roles panel has its own display

  walkthrough: [
    {
      id: "view-distribution",
      instruction:
        "The panel shows how many players were detected in each role",
      waitFor: "manual",
    },
    {
      id: "check-composition",
      instruction:
        "Verify your raid has enough tanks and healers for the content",
      waitFor: "manual",
    },
  ],
};
