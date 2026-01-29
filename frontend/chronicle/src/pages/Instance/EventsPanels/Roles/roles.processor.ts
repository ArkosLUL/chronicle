/**
 * Roles inference utilities - infers player roles (Tank, Healer, DPS) using outlier detection
 * 
 * This module provides role inference from damage taken and healing done data.
 * It does NOT have its own processor - instead, the RolesContent component
 * reuses data from the damage_taken and healing_done processors.
 * 
 * Tank detection: Players who take significantly more damage than others (outliers)
 * Healer detection: Players who do significantly more healing than others (outliers)
 * DPS: Everyone else
 * 
 * Uses standard deviation method for outlier detection, with class hints
 * to improve accuracy for hybrid classes.
 */

/**
 * Inferred role for a player
 */
export type InferredRole = "tank" | "healer" | "dps";

/**
 * Player role data
 */
export interface PlayerRoleData {
  playerID: string;
  playerName: string;
  className: string;
  
  /** The inferred role */
  role: InferredRole;
}

/**
 * Role summary
 */
export interface RoleSummary {
  tanks: PlayerRoleData[];
  healers: PlayerRoleData[];
  dps: PlayerRoleData[];
}



/**
 * Calculate mean of an array of numbers
 */
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Calculate standard deviation
 */
function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const squaredDiffs = values.map(v => (v - avg) ** 2);
  return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length);
}

/**
 * Calculate z-score (how many standard deviations from the mean)
 */
function zScore(value: number, avg: number, sd: number): number {
  if (sd === 0) return value > avg ? Infinity : 0;
  return (value - avg) / sd;
}

/**
 * Debug info about thresholds used for role detection
 */
export interface RoleDetectionDebug {
  /** Z-score threshold for tank detection (e.g., 1.5 = 1.5 std devs above mean) */
  tankZThreshold: number;
  /** Z-score threshold for healer detection */
  healerZThreshold: number;
  meanDamageTaken: number;
  stdDevDamageTaken: number;
  meanHealingDone: number;
  stdDevHealingDone: number;
  /** Actual damage taken cutoff (mean + z * stddev) */
  tankCutoff: number;
  /** Actual healing done cutoff (mean + z * stddev) */
  healerCutoff: number;
}

/**
 * Result of role inference including debug info
 */
export interface InferRolesResult {
  roles: Map<string, PlayerRoleData>;
  debug: RoleDetectionDebug;
}

// Z-score thresholds for role detection
// Lower = more sensitive (catches more tanks/healers)
// 1.0 = 1 standard deviation above mean (catches ~16% of highest values)
// 1.5 = 1.5 standard deviations (catches ~7% of highest values)
const TANK_Z_THRESHOLD = 1.5;
const HEALER_Z_THRESHOLD = 1.0;

/**
 * Infer roles from damage taken and healing done data.
 * Does not need damage done - DPS is just "everyone else".
 * 
 * Uses z-score (standard deviations from mean) to identify outliers.
 * Players with z-score above threshold AND matching class are assigned roles.
 */
export function inferRoles(
  damageTaken: Map<string, number>,
  healingDone: Map<string, number>,
  players: Record<string, { name: string; class: string }>
): InferRolesResult {
  const result = new Map<string, PlayerRoleData>();
  
  // Get all player IDs from both maps
  const playerIds = new Set([
    ...damageTaken.keys(),
    ...healingDone.keys(),
  ]);
  
  const emptyDebug: RoleDetectionDebug = {
    tankZThreshold: TANK_Z_THRESHOLD,
    healerZThreshold: HEALER_Z_THRESHOLD,
    meanDamageTaken: 0,
    stdDevDamageTaken: 0,
    meanHealingDone: 0,
    stdDevHealingDone: 0,
    tankCutoff: 0,
    healerCutoff: 0,
  };
  
  if (playerIds.size === 0) return { roles: result, debug: emptyDebug };
  
  // Get values (include zeros to not skew statistics)
  const dtValues = [...damageTaken.values()];
  const hdValues = [...healingDone.values()];
  
  // Calculate statistics for damage taken
  const meanDT = mean(dtValues);
  const stdDT = stdDev(dtValues);
  
  // Calculate statistics for healing done
  const meanHD = mean(hdValues);
  const stdHD = stdDev(hdValues);
  
  // Calculate actual cutoffs
  const tankCutoff = meanDT + TANK_Z_THRESHOLD * stdDT;
  const healerCutoff = meanHD + HEALER_Z_THRESHOLD * stdHD;
  
  const debug: RoleDetectionDebug = {
    tankZThreshold: TANK_Z_THRESHOLD,
    healerZThreshold: HEALER_Z_THRESHOLD,
    meanDamageTaken: meanDT,
    stdDevDamageTaken: stdDT,
    meanHealingDone: meanHD,
    stdDevHealingDone: stdHD,
    tankCutoff,
    healerCutoff,
  };
  
  for (const playerID of playerIds) {
    const dt = damageTaken.get(playerID) || 0;
    const hd = healingDone.get(playerID) || 0;
    const playerInfo = players[playerID];
    const playerClass = playerInfo?.class || "UNKNOWN";
    
    // Calculate z-scores
    const dtZScore = zScore(dt, meanDT, stdDT);
    const hdZScore = zScore(hd, meanHD, stdHD);
    
    // Determine role using z-score (anyone can tank or heal if they do well enough)
    let role: InferredRole = "dps";
    
    // Tank detection: high z-score for damage taken
    const isTankOutlier = dtZScore >= TANK_Z_THRESHOLD && dt > 0;
    
    // Healer detection: high z-score for healing done
    const isHealerOutlier = hdZScore >= HEALER_Z_THRESHOLD && hd > 0;
    
    // Prioritize tank detection over healer (someone taking tons of damage is probably tanking)
    if (isTankOutlier) {
      role = "tank";
    } else if (isHealerOutlier) {
      role = "healer";
    }
    
    result.set(playerID, {
      playerID,
      playerName: playerInfo?.name || playerID,
      className: playerClass,
      role,
    });
  }
  
  return { roles: result, debug };
}

/**
 * Get role summary from player roles, sorted alphabetically by name
 */
export function getRoleSummary(roles: Map<string, PlayerRoleData>): RoleSummary {
  const tanks: PlayerRoleData[] = [];
  const healers: PlayerRoleData[] = [];
  const dps: PlayerRoleData[] = [];
  
  for (const data of roles.values()) {
    switch (data.role) {
      case "tank":
        tanks.push(data);
        break;
      case "healer":
        healers.push(data);
        break;
      case "dps":
        dps.push(data);
        break;
    }
  }
  
  // Sort alphabetically by name
  const sortByName = (a: PlayerRoleData, b: PlayerRoleData) => 
    a.playerName.localeCompare(b.playerName);
  
  tanks.sort(sortByName);
  healers.sort(sortByName);
  dps.sort(sortByName);
  
  return { tanks, healers, dps };
}
