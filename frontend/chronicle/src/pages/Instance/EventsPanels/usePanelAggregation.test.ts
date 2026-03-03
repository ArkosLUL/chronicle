import { describe, it, expect } from "vitest";
import { resolveAggregationResultForPanel } from "./usePanelAggregation";

describe("resolveAggregationResultForPanel", () => {
  it("returns cached result when panel id matches", () => {
    const previous = { marker: "damage_done" };

    const result = resolveAggregationResultForPanel(
      { panelId: "damage_done", result: previous },
      "damage_done",
      () => ({ marker: "new" }),
    );

    expect(result).toBe(previous);
  });

  it("returns fresh createState result when panel id changes", () => {
    const result = resolveAggregationResultForPanel(
      { panelId: "healing_done", result: { marker: "healing" } },
      "damage_taken",
      () => ({ marker: "damage_taken" }),
    );

    expect(result).toEqual({ marker: "damage_taken" });
  });
});
