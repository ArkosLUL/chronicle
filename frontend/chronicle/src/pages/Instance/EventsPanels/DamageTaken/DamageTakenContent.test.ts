import { describe, it, expect } from "vitest";
import { hasDamageTakenEncounterData } from "./DamageTakenContent";

describe("hasDamageTakenEncounterData", () => {
  it("returns false for malformed foreign result objects", () => {
    expect(hasDamageTakenEncounterData(undefined)).toBe(false);
    expect(hasDamageTakenEncounterData(null)).toBe(false);
    expect(hasDamageTakenEncounterData({})).toBe(false);
    expect(hasDamageTakenEncounterData({ EncounterDamage: undefined })).toBe(false);
    expect(hasDamageTakenEncounterData({ EncounterDamage: [] })).toBe(false);
  });

  it("returns false when encounter map is empty", () => {
    expect(hasDamageTakenEncounterData({ EncounterDamage: new Map() })).toBe(false);
  });

  it("returns true when encounter map contains data", () => {
    const encounterDamage = new Map<string, unknown>();
    encounterDamage.set("enc-1", new Map());

    expect(hasDamageTakenEncounterData({ EncounterDamage: encounterDamage })).toBe(true);
  });
});
