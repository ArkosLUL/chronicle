/**
 * Healing Done panel - React component wrapper for healing aggregation
 */

import { Heart } from "lucide-react";
import type { PanelDefinition, PanelRenderProps, EntityValueMap } from "./types";
import { EntityValueList } from "./EntityValueList";
import { healingDoneProcessor, type HealingDoneState } from "./processors";

export const HealingDonePanel: PanelDefinition<HealingDoneState> = {
  ...healingDoneProcessor,
  label: "Healing Done",
  icon: <Heart className="h-4 w-4" />,
  
  render: (props: PanelRenderProps<EntityValueMap>) => (
    <EntityValueList {...props} valueLabel="Healing" />
  ),
};
