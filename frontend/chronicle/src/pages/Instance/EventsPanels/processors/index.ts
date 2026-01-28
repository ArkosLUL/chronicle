/**
 * Registry of all panel processors (worker-safe).
 */

import type { PanelProcessor } from "../processorTypes";
import { damageDoneProcessor, enemyDamageDoneProcessor, petDamageDoneProcessor } from "../DamageDone/damageDone.processor";
import { damageTakenProcessor, enemyDamageTakenProcessor } from "../DamageTaken/damageTaken.processor";
import { healingDoneProcessor } from "./healingDone.processor";
import { allActivityProcessor } from "./allActivity.processor";

// Export individual processors
export { damageDoneProcessor, enemyDamageDoneProcessor, petDamageDoneProcessor } from "../DamageDone/damageDone.processor";
export { damageTakenProcessor, enemyDamageTakenProcessor } from "../DamageTaken/damageTaken.processor";
export { healingDoneProcessor } from "./healingDone.processor";
export { allActivityProcessor } from "./allActivity.processor";

// Export state types
export type { DamageDoneResult as DamageDoneState, DamageDoneData, DamageSourceType } from "../DamageDone/damageDone.processor";
export type { DamageTakenResult as DamageTakenState, DamageTakenData, DamageTargetType } from "../DamageTaken/damageTaken.processor";
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
  damage_taken_enemies: enemyDamageTakenProcessor,
  healing_done: healingDoneProcessor,
  all_activity: allActivityProcessor,
};
