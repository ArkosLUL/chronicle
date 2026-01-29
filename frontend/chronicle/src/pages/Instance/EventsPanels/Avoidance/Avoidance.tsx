/**
 * Physical Avoidance panel - shows attacks avoided via dodge, parry, or block.
 */

import { BicepsFlexed } from "lucide-react";
import type { PanelDefinition, PanelRenderProps } from "../types";
import { avoidanceProcessor, type AvoidanceResult } from "../processors";
import { AvoidanceContent } from "./AvoidanceContent";

/**
 * Create the AvoidancePanel definition.
 */
export function createAvoidancePanel(): PanelDefinition<AvoidanceResult, unknown> {
  return {
    ...avoidanceProcessor,
    label: "Physical Avoidance",
    icon: <BicepsFlexed className="h-4 w-4" />,
    
    render: (props: PanelRenderProps<AvoidanceResult>) => {
      return <AvoidanceContent {...props} />;
    },
  };
}
