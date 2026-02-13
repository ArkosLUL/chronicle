/**
 * Tip pools for contextual help throughout the Instance page.
 * 
 * Each location has a pool of tips that are randomly shown on hover.
 * This keeps the UI fresh and helps users discover features over time.
 */

/** Tips for the encounter sidebar */
export const ENCOUNTER_TIPS = [
  "Ctrl/Cmd+click to select multiple encounters",
  "Use 'Bosses' button to quickly filter to only boss fights",
  "Click the view toggle to switch between grouped and chronological order",
  "Multi-selecting encounters shows combined metrics",
];

/** Tips for the entity selection panel */
export const ENTITY_TIPS = [
  "Selecting enemies or players filters damage to/from those entities",
  "Try using the \"Roles\" panel to quickly select all tanks, healers, or DPS",
];

/** Tips for class labels in the entity panel (e.g., "WAR:") */
export const CLASS_TOGGLE_TIPS = [
  "Click to toggle all players of this class",
];
