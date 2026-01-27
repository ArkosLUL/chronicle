/**
 * Registry of all panel processors (worker-safe).
 */

import type { PanelProcessor } from "../processorTypes";
import { damageDoneProcessor, enemyDamageDoneProcessor, petDamageDoneProcessor } from "../DamageDone/damageDone.processor";
import { damageTakenProcessor } from "./damageTaken.processor";
import { healingDoneProcessor } from "./healingDone.processor";
import { allActivityProcessor } from "./allActivity.processor";

// Export individual processors
export { damageDoneProcessor, enemyDamageDoneProcessor, petDamageDoneProcessor } from "../DamageDone/damageDone.processor";
export { damageTakenProcessor } from "./damageTaken.processor";
export { healingDoneProcessor } from "./healingDone.processor";
export { allActivityProcessor } from "./allActivity.processor";

// Export state types
export type { DamageDoneState, DamageDoneData, DamageSourceType } from "../DamageDone/damageDone.processor";
export type { DamageTakenState } from "./damageTaken.processor";
export type { HealingDoneState } from "./healingDone.processor";
export type { AllActivityState } from "./allActivity.processor";

/**
 * Registry of all processors by panel ID.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const processorRegistry: Record<string, PanelProcessor<any>> = {
  damage_done: damageDoneProcessor,
  damage_done_enemies: enemyDamageDoneProcessor,
  damage_done_pets: petDamageDoneProcessor,
  damage_taken: damageTakenProcessor,
  healing_done: healingDoneProcessor,
  all_activity: allActivityProcessor,
};
