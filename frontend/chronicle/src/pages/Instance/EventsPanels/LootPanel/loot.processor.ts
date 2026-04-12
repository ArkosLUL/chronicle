import type { PanelProcessor } from "../processorTypes";

export type LootResult = Record<string, never>;

export const lootProcessor: PanelProcessor<LootResult> = {
  id: "loot",
  streams: [],
  createState: (): LootResult => ({}),
  processEvent: () => {},
};
