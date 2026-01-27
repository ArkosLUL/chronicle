/**
 * Damage Done panel - aggregates damage by caster
 */

import { Swords } from "lucide-react";
import type { PanelDefinition, PanelRenderProps, EntityValueMap } from "./types";
import { EntityValueList } from "./EntityValueList";

export const DamageDonePanel: PanelDefinition<EntityValueMap> = {
  id: "damage_done",
  label: "Damage Done",
  icon: <Swords className="h-4 w-4" />,
  streams: ["damage"],
  
  createState: () => new Map<string, number>(),
  
  processEvent: (state, event, _encounterID, streamType) => {
    // Only process damage events
    if (streamType !== "damage") return;
    
    const key = event.caster || "Unknown";
    state.set(key, (state.get(key) || 0) + event.amount);
  },
  
  render: (props: PanelRenderProps<EntityValueMap>) => (
    <EntityValueList {...props} valueLabel="Damage" />
  ),
};
