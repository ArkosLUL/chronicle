/**
 * Registry of all panel processors (worker-safe).
 */

import type { PanelProcessor } from "../processorTypes";
import { damageDoneProcessor, enemyDamageDoneProcessor, petDamageDoneProcessor } from "../DamageDone/damageDone.processor";
import { damageTakenProcessor, enemyDamageTakenProcessor } from "../DamageTaken/damageTaken.processor";
import { extraAttacksProcessor } from "../ExtraAttacks/extraAttacks.processor";
import { deathsProcessor } from "../Deaths/deaths.processor";
import { allActivityProcessor } from "./allActivityDebug.processor";
import { unifiedHealingProcessor } from "./healing.processor";
import { mitigationProcessor } from "./mitigation.processor";
import { avoidanceProcessor } from "./avoidance.processor";

// Export individual processors
export { damageDoneProcessor, enemyDamageDoneProcessor, petDamageDoneProcessor } from "../DamageDone/damageDone.processor";
export { damageTakenProcessor, enemyDamageTakenProcessor } from "../DamageTaken/damageTaken.processor";
export { extraAttacksProcessor } from "../ExtraAttacks/extraAttacks.processor";
export { deathsProcessor } from "../Deaths/deaths.processor";
export { allActivityProcessor } from "./allActivityDebug.processor";
export { unifiedHealingProcessor } from "./healing.processor";
export { mitigationProcessor } from "./mitigation.processor";
export { avoidanceProcessor } from "./avoidance.processor";

// Export state types
export type { DamageDoneResult as DamageDoneState, DamageDoneData, DamageSourceType } from "../DamageDone/damageDone.processor";
export type { DamageTakenResult as DamageTakenState, DamageTakenData, DamageTargetType } from "../DamageTaken/damageTaken.processor";
export type { UnifiedHealingResult, HealerData, HealingReceiverData, HealingTargetData, HealingSourceData } from "./healing.processor";
export type { ExtraAttacksResult as ExtraAttacksState, ExtraAttacksData } from "../ExtraAttacks/extraAttacks.processor";
export type { DeathsResult as DeathsState, DeathEvent, PlayerDeathsData } from "../Deaths/deaths.processor";
export type { AllActivityDebugState as AllActivityState, RawDebugEvent, EncounterMeta, ResourceType } from "./allActivityDebug.processor";
export type { MitigationResult, MitigationData, EncounterMitigation } from "./mitigation.processor";
export type { AvoidanceResult, AvoidanceData, EncounterAvoidance } from "./avoidance.processor";

// Export shared utilities
export { accumulateAbilityBreakout, createEmptyAbilityBreakout, updateAbilityBreakout, type DamageAbilityBreakout } from "./abilityBreakout";

export { isResourceChangeEvent, isHealingEvent, isDamageEvent } from "./events";

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
  // Unified healing processor for both healing_done and healing_taken
  healing_done: unifiedHealingProcessor,
  healing_taken: unifiedHealingProcessor, // Same processor, different view
  extra_attacks: extraAttacksProcessor,
  deaths: deathsProcessor,
  death_log: deathsProcessor, // Same processor, different view
  all_activity: allActivityProcessor,
  mitigation: mitigationProcessor,
  avoidance: avoidanceProcessor,
};
