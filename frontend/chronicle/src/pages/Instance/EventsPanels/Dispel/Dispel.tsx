/**
 * Dispel panels - React component wrappers for dispel tracking.
 *
 * Two panels share a single processor:
 * - Dispels Done: who performed dispels (grouped by caster)
 * - Dispels Received: whose auras were removed (grouped by target)
 */

import { Eraser } from "lucide-react";
import type { PanelDefinition, PanelRenderProps } from "../types";
import { dispelProcessor, type DispelResult } from "./dispel.processor";
import { DispelContent } from "./DispelContent";
import { ENTITY_GROUPING_OPTIONS, MERGED_GROUPING_OPTIONS, PET_GROUPING_OPTIONS, type GroupingOption } from "../processors/resolveEntity";

/** Pet options with "individual" as default (first). */
const INDIVIDUAL_PET_OPTIONS: GroupingOption[] = [
  { value: "owner", label: "With Owner" },
  { value: "individual", label: "Individual" },
  { value: "name", label: "Name" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDispelsDonePanel(): PanelDefinition<DispelResult, any> {
  return {
    ...dispelProcessor,
    id: "dispels_done",
    label: "Dispels Done",
    icon: <Eraser className="h-4 w-4" />,
    supportsPerSecond: true,
    supportsFiltering: true,
    groupingOptions: MERGED_GROUPING_OPTIONS,
    petOptions: PET_GROUPING_OPTIONS,
    defaultFilters: [
      { type: "time_range" as const, value: "controller" },
      { type: "source_type" as const, value: ["player", "pet"] },
      { type: "target_type" as const, value: "selected_players" },
    ],

    render: (props: PanelRenderProps<DispelResult>) => {
      return <DispelContent {...props} perspective="done" />;
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDispelsReceivedPanel(): PanelDefinition<DispelResult, any> {
  return {
    ...dispelProcessor,
    id: "dispels_received",
    label: "Dispels Received",
    icon: <Eraser className="h-4 w-4" />,
    supportsPerSecond: true,
    supportsFiltering: true,
    groupingOptions: ENTITY_GROUPING_OPTIONS,
    petOptions: INDIVIDUAL_PET_OPTIONS,
    defaultFilters: [
      { type: "time_range" as const, value: "controller" },
      { type: "source_type" as const, value: "selected_players" },
      { type: "target_type" as const, value: "selected_players" },
    ],

    render: (props: PanelRenderProps<DispelResult>) => {
      return <DispelContent {...props} perspective="received" />;
    },
  };
}
