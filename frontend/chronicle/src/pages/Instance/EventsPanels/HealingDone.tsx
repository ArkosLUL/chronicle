/**
 * Healing Done panel - aggregates healing by caster
 */

import { Heart } from "lucide-react";
import type { PanelDefinition, PanelRenderProps, EntityValueMap } from "./types";
import { EntityValueList } from "./EntityValueList";

export const HealingDonePanel: PanelDefinition<EntityValueMap> = {
  id: "healing_done",
  label: "Healing Done",
  icon: <Heart className="h-4 w-4" />,
  streams: ["heal"],
  
  createState: () => new Map<string, number>(),
  
  processEvent: (state, event, _encounterID, streamType, context) => {
    if (streamType !== "heal") return;
    
    // Filter by selected players if any are selected
    const { entitySelection } = context;
    if (entitySelection.playerIds.size > 0) {
      if (!entitySelection.playerIds.has(event.caster)) return;
    }
    
    const key = event.caster || "Unknown";
    state.set(key, (state.get(key) || 0) + event.amount);
  },
  
  render: (props: PanelRenderProps<EntityValueMap>) => (
    <EntityValueList {...props} valueLabel="Healing" />
  ),
};
