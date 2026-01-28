/**
 * Registry of all panel processors (worker-safe).
 */

import type { PanelProcessor } from "../processorTypes";
import { damageDoneProcessor, enemyDamageDoneProcessor, petDamageDoneProcessor } from "../DamageDone/damageDone.processor";
import { damageTakenProcessor, enemyDamageTakenProcessor } from "../DamageTaken/damageTaken.processor";
import { healingDoneProcessor } from "../HealingDone/healingDone.processor";
import { extraAttacksProcessor } from "../ExtraAttacks/extraAttacks.processor";
import { healingTakenProcessor } from "../HealingTaken/healingTaken.processor";
import { deathsProcessor } from "../Deaths/deaths.processor";
import { allActivityProcessor } from "./allActivity.processor";

// Export individual processors
export { damageDoneProcessor, enemyDamageDoneProcessor, petDamageDoneProcessor } from "../DamageDone/damageDone.processor";
export { damageTakenProcessor, enemyDamageTakenProcessor } from "../DamageTaken/damageTaken.processor";
export { healingDoneProcessor } from "../HealingDone/healingDone.processor";
export { extraAttacksProcessor } from "../ExtraAttacks/extraAttacks.processor";
export { healingTakenProcessor } from "../HealingTaken/healingTaken.processor";
export { deathsProcessor } from "../Deaths/deaths.processor";
export { allActivityProcessor } from "./allActivity.processor";

// Export state types
export type { DamageDoneResult as DamageDoneState, DamageDoneData, DamageSourceType } from "../DamageDone/damageDone.processor";
export type { DamageTakenResult as DamageTakenState, DamageTakenData, DamageTargetType } from "../DamageTaken/damageTaken.processor";
export type { HealingDoneResult as HealingDoneState, HealingDoneData, HealingSourceType } from "../HealingDone/healingDone.processor";
export type { ExtraAttacksResult as ExtraAttacksState, ExtraAttacksData } from "../ExtraAttacks/extraAttacks.processor";
export type { HealingTakenResult as HealingTakenState, HealingTakenData, HealingTargetType } from "../HealingTaken/healingTaken.processor";
export type { DeathsResult as DeathsState, DeathEvent, PlayerDeathsData } from "../Deaths/deaths.processor";
export type { AllActivityState } from "./allActivity.processor";

// Export shared utilities
export { accumulateAbilityBreakout, createEmptyAbilityBreakout, updateAbilityBreakout, type DamageAbilityBreakout } from "./abilityBreakout";

export { isResourceChangeEvent, isHealingEvent } from "./events";

/**
 * Registry of all processors by panel ID.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const processorRegistry: Record<string, PanelProcessor<any, any>> = {
  damage_done: damageDoneProcessor,
  damage_done_enemies: enemyDamageDoneProcessor,
  damage_done_pets: petDamageDoneProcessor,
  damage_taken: damageTakenProcessor,
  damage_taken_enemies: enemyDamageTakenProcessor,
  healing_done: healingDoneProcessor,
  extra_attacks: extraAttacksProcessor,
  healing_taken: healingTakenProcessor,
  deaths: deathsProcessor,
  all_activity: allActivityProcessor,
};
