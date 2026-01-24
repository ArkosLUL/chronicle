import type { Ability, EncounterDamageSummary, InstancePlayer } from "@/api/typesGenerated";
import type { PlayerMetricChartData, RawAbilities } from "@/components/ui/PlayerMetricChart/PlayerMetricChart";
import type { GUID } from "@/lib/guid/guid";

export type PanelType = 'damage_done' | 'damage_taken' | 'enemy_damage_done' | 'enemy_damage_taken';

export interface PanelConfig {
  label: string;
  chartType: 'damage' | 'healing';
  /** Transform raw damage summary into chart data */
  transform: (
    panelType : PanelType,
    data: EncounterDamageSummary[],
    players: Record<string, InstancePlayer>,
    enemies: Map<string, string>,
    selectedPlayerIds: Set<string>,
    selectedEnemyIds: Set<string>
  ) => PlayerMetricChartData[];
}

// ============================================================================
// Data transformation helpers
// ============================================================================

function filterAbilities(targetFilter: Set<string>, records: Record<string, Record<string, Ability>>): ({
  total: number;
  filtered: Record<string, Record<string, Ability>>
}) {
  const result: Record<string, Record<string, Ability>> = {};
  let total = 0;

  for (const key in records) {
    if (!Object.prototype.hasOwnProperty.call(records, key))
      continue;

    if (targetFilter.size === 0 || targetFilter.has(key)) {
      result[key] = records[key];
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      total += Object.entries(records[key]).reduce((sum, [_, ability]) => sum + ability.total, 0);
    }
  }
  return { total, filtered: result };
}

/**
 * Aggregate damage summary records by unit GUID.
 * Returns a map of GUID -> aggregated totals and abilities.
 */
function aggregateByUnit(targetFilter: Set<string>, records: EncounterDamageSummary[]): Map<string, {
  damageDoneTotal: number;
  damageTakenTotal: number;
  damageDoneAbilities: RawAbilities;
  damageTakenAbilities: RawAbilities;
  isPlayer: boolean;
  name: string;
  ownerGuid: GUID | null;
}> {
  const result = new Map<string, {
    damageDoneTotal: number;
    damageTakenTotal: number;
    damageDoneAbilities: RawAbilities;
    damageTakenAbilities: RawAbilities;
    isPlayer: boolean;
    ownerGuid: GUID | null;
    name: string;
  }>();

  for (const record of records) {
    const guid = String(record.unit_guid);
    const existing = result.get(guid);

    if (existing) {
      // Merge abilities - for simplicity, later records override earlier ones
      // A more sophisticated merge would sum ability values
      existing.damageDoneTotal += mergeAbilities(targetFilter, existing.damageDoneAbilities, record.damage_done_abilities);
      existing.damageTakenTotal += mergeAbilities(targetFilter, existing.damageTakenAbilities, record.damage_taken_abilities);
      continue;
    } 

    const {total: totalDamage, filtered: damageDone} = filterAbilities(targetFilter, record.damage_done_abilities);
    const {total: totalTaken, filtered: damageTaken} = filterAbilities(targetFilter, record.damage_taken_abilities);

    result.set(guid, {
      damageDoneTotal: totalDamage,
      damageTakenTotal: totalTaken,
      damageDoneAbilities: damageDone,
      damageTakenAbilities: damageTaken,
      isPlayer: record.is_player,
      ownerGuid: record.owner_guid,
      name: record.unit_name,
    });
  }

  return result;
}

/**
 * Merge source abilities into target (mutates target).
 */
function mergeAbilities(targetFilter: Set<string>, target: RawAbilities, source: RawAbilities): number {
  let total = 0;
  for (const [targetGuid, abilities] of Object.entries(source)) {
    if (targetFilter.size > 0 && !targetFilter.has(targetGuid)) {
      continue;
    }
    if (!target[targetGuid]) {
      target[targetGuid] = {};
    }
    for (const [abilityName, ability] of Object.entries(abilities)) {
      const existing = target[targetGuid][abilityName];
      if (existing) {
        Object.keys(ability).forEach((key) => {
          // TODO: Check this
          // @ts-ignore
          existing[key] += ability[key];
          // @ts-ignore
          total += ability[key].total;
        });
      } else {
        target[targetGuid][abilityName] = { ...ability };
      }
    }
  }
  return total
}

// ============================================================================
// Panel-specific transformations
// ============================================================================

function terraformGeneral(
  panelType : PanelType,
  data: EncounterDamageSummary[],
  players: Record<string, InstancePlayer>,
  enemies: Map<string, string>,
  selectedPlayerIds: Set<string>,
  selectedEnemyIds: Set<string>
) : PlayerMetricChartData[] {
  // Filter data based on panel type and selections
  switch (panelType) {
    case 'damage_done':
    case 'damage_taken':
      data = data.filter(record => {
        return record.is_player
      });
      break
    case 'enemy_damage_done':
    case 'enemy_damage_taken':
      data = data.filter(record => {
        return !record.is_player
      });
      break;
    default:
      throw new Error(`Unknown panel type: ${panelType}`);
  }

  let targetFilter = selectedPlayerIds
  switch (panelType) {
    case 'damage_done':
    case 'damage_taken':
      targetFilter = selectedEnemyIds
      break
    case 'enemy_damage_done':
    case 'enemy_damage_taken':
      targetFilter = selectedPlayerIds
      break;
    default:
      throw new Error(`Unknown panel type: ${panelType}`);
  }

  const aggregated = aggregateByUnit(targetFilter, data);
  const result: Record<string, PlayerMetricChartData> = {};
  for (const [guid, stats] of aggregated) {
    const player = players[guid];
    const enemyName = stats.name || enemies.get(guid);
    switch (panelType) {
      case 'damage_done':
        if (!stats.isPlayer) continue;
        if (!player) continue;

        result[guid] = {
          playerID: guid,
          playerName: player.name,
          className: player.class,
          specialization: "",
          value: stats.damageDoneTotal,
          rawAbilities: stats.damageDoneAbilities,
          dimmed: selectedPlayerIds.size > 0 && !selectedPlayerIds.has(guid),
        };
        break;
      case 'damage_taken':
        if (!stats.isPlayer) continue;
          if (!player) continue;

        result[guid] = {
          playerID: guid,
          playerName: player.name,
          className: player.class,
          specialization: "",
          value: stats.damageTakenTotal,
          rawAbilities: stats.damageTakenAbilities,
          dimmed: selectedPlayerIds.size > 0 && !selectedPlayerIds.has(guid),
        };
        break;
      case 'enemy_damage_done':
        if (stats.isPlayer) continue;
        result[guid] = {
          playerID: guid,
          playerName: enemyName || `Enemy ${guid.slice(-8)}`,
          className: "CREATURE",
          specialization: "",
          value: stats.damageDoneTotal,
          rawAbilities: stats.damageDoneAbilities,
          dimmed: selectedPlayerIds.size > 0 && !selectedEnemyIds.has(guid),
        };
        break;
      case 'enemy_damage_taken':
        if (stats.isPlayer) continue;
        result[guid] = {
          playerID: guid,
          playerName: enemyName || `Enemy ${guid.slice(-8)}`,
          className: "CREATURE",
          specialization: "",
          value: stats.damageTakenTotal,
          rawAbilities: stats.damageTakenAbilities,
          dimmed: selectedPlayerIds.size > 0 && !selectedEnemyIds.has(guid),
        };
        break;
      default:
        throw new Error(`Unknown panel type: ${panelType}`);
    }
  }
  
  return Object.values(result)
}

// ============================================================================
// Panel configuration
// ============================================================================

export const PANEL_CONFIGS: Record<PanelType, PanelConfig> = {
  damage_done: {
    label: 'Damage Done',
    chartType: 'damage',
    transform: terraformGeneral,
  },
  damage_taken: {
    label: 'Damage Taken',
    chartType: 'damage',
    transform: terraformGeneral,
  },
  enemy_damage_done: {
    label: 'Enemy Damage Done',
    chartType: 'damage',
    transform: terraformGeneral,
  },
  enemy_damage_taken: {
    label: 'Enemy Damage Taken',
    chartType: 'damage',
    transform: terraformGeneral,
  },
};

export const PANEL_OPTIONS: { value: PanelType; label: string }[] = Object.entries(PANEL_CONFIGS).map(
  ([value, config]) => ({ value: value as PanelType, label: config.label })
);
