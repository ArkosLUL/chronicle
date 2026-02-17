// WoWDB types for spell data from /api/v1/wowdb/spell/{id}

// i18n.Text serializes as Record<locale, string> where "0" = enUS
export type I18nText = Record<string, string>;

// Common pattern for enum fields with custom JSON marshaling
export interface EnumValue<T = number> {
  value: T;
  string: string;
}

// Bitmask fields
export interface MaskValue {
  mask: number;
  string: string;
}

// Embedded DBC lookups
export interface SpellIcon {
  ID: number;
  TextureFilename: string;
}

export interface SpellRange {
  ID: number;
  RangeMin: number;
  RangeMax: number;
  Flags: number;
  Name: string;
}

export interface SpellDuration {
  ID: number;
  Duration: number; // milliseconds
  DurationPerLevel: number;
  MaxDuration: number;
}

export interface SpellCastTime {
  ID: number;
  Base: number; // milliseconds
  PerLevel: number;
  Minimum: number;
}

export interface SpellRadius {
  ID: number;
  Radius: number;
  RadiusPerLevel: number;
  RadiusMin: number;
  RadiusMax: number;
}

export interface SpellCategory {
  ID: number;
  Flags: number;
  UsesPerWeek: number;
  Name: string;
  MaxCharges: number;
  ChargeRecoveryTime: number;
  TypeMask: number;
}

export interface WoWSpell {
  id: number;
  name: I18nText;
  subtext: I18nText; // "Rank 1", etc.
  description: I18nText;
  aura_description: I18nText;

  // Display - already includes TextureFilename!
  spell_icon: SpellIcon;
  active_icon: SpellIcon;

  // Level
  spell_level: number;
  base_level: number;
  max_level: number;

  // Category
  category: SpellCategory;

  // School & Class
  school: EnumValue; // {value: 1, string: "Holy"}
  spell_class_set: EnumValue; // {value: 6, string: "Priest"}
  spell_class_mask: number;

  // Resource cost
  power_type: EnumValue; // {value: 0, string: "Mana"}
  mana_cost: number;
  mana_cost_pct: number;
  mana_cost_per_level: number;
  mana_per_second: number;
  reagent: number[];
  reagent_count: number[];

  // Timing - embedded DBC lookups
  casting_time: SpellCastTime;
  range: SpellRange;
  duration: SpellDuration;
  recovery_time: number; // nanoseconds (cooldown)
  start_recovery_time: number; // GCD in nanoseconds
  start_recovery_category: number;
  category_recovery_time: number;

  // Mechanics
  mechanic: EnumValue;
  dispel_type: EnumValue;
  prevention_type: EnumValue;
  defense_type: EnumValue;
  caster_aura_state: EnumValue;
  target_aura_state: EnumValue;
  interrupt_flags: MaskValue;
  aura_interrupt_flags: MaskValue;

  // Effects (3 slots)
  effect: EnumValue[]; // [{value: 6, string: "ApplyAura"}, ...]
  effect_aura: EnumValue[]; // [{value: 8, string: "PeriodicHeal"}, ...]
  effect_base_points: number[];
  effect_die_sides: number[];
  effect_base_dice: number[];
  effect_dice_per_level: number[];
  effect_real_points_per_level: number[];
  effect_aura_period: number[]; // milliseconds between ticks
  effect_amplitude: number[];
  effect_chain_amplitude: number[];
  effect_chain_targets: number[];
  effect_trigger_spell: number[];
  effect_item_type: number[];
  effect_misc_value: number[];
  effect_mechanic: number[];
  effect_points_per_combo: number[];
  effect_radius: SpellRadius[];
  implicit_target_a: EnumValue[];
  implicit_target_b: EnumValue[];

  // Proc
  proc_chance: number;
  proc_charges: number;
  proc_type_mask: MaskValue;
  proc_flags: MaskValue;

  // Targeting
  targets: MaskValue;
  max_targets: number;
  max_target_level: number;
  target_creature_type: MaskValue;

  // Attributes (9 uint32 bitmasks)
  attributes: number[];

  // Equipped item requirements
  equipped_item_class: EnumValue;
  equipped_item_subclass: number;
  equipped_item_inv_types: MaskValue;

  // Other
  speed: number;
  spell_priority: number;
  stance_bar_order: number;
  cumulative_aura: number;
  modal_next_spell: number;
  requires_spell_focus: { ID: number; Name: string };
  totems_id: number;
  totem: number[];
  cast_ui: number;
  required_aura_vision: number;
  min_faction_id: number;
  min_reputation: number;
  spell_visual_id: number[];
}

// === Helpers ===

export function getEnglishText(text: I18nText | undefined): string {
  if (!text) return "";
  return text["0"] || Object.values(text)[0] || "";
}

export function getSpellIconUrl(icon: SpellIcon): string {
  if (!icon.TextureFilename) return "";
  return `https://icons.chronicleclassic.com/${icon.TextureFilename.toLowerCase()}.webp`;
}

export function formatCastTime(castTime: SpellCastTime): string {
  if (castTime.Base === 0) return "Instant";
  return `${(castTime.Base / 1000).toFixed(1)} sec`;
}

export function formatDuration(duration: SpellDuration): string {
  if (duration.Duration === 0) return "Instant";
  const secs = duration.Duration / 1000;
  if (secs >= 60) return `${Math.floor(secs / 60)} min`;
  return `${secs} sec`;
}

export function formatRange(range: SpellRange): string {
  if (range.RangeMax === 0) return "Self";
  return `${range.RangeMax} yd`;
}

export function formatCooldown(recoveryTimeNs: number): string | null {
  if (recoveryTimeNs === 0) return null;
  const secs = recoveryTimeNs / 1_000_000_000;
  if (secs >= 60) return `${Math.floor(secs / 60)} min cooldown`;
  return `${secs} sec cooldown`;
}

// School colors for styling (by school value)
export const SCHOOL_COLORS: Record<number, string> = {
  0: "text-gray-400", // Physical
  1: "text-yellow-300", // Holy
  2: "text-orange-500", // Fire
  3: "text-green-400", // Nature
  4: "text-blue-400", // Frost
  5: "text-purple-400", // Shadow
  6: "text-pink-400", // Arcane
};
