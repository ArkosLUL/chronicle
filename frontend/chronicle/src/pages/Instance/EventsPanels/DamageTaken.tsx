/**
 * Damage Taken panel - aggregates damage by target
 */

import { Shield } from "lucide-react";
import type { PanelDefinition, PanelRenderProps, EntityValueMap } from "./types";
import { EntityValueList } from "./EntityValueList";

export const DamageTakenPanel: PanelDefinition<EntityValueMap> = {
  id: "damage_taken",
  label: "Damage Taken",
  icon: <Shield className="h-4 w-4" />,
  streams: ["damage"],
  
  createState: () => new Map<string, number>(),
  
  processEvent: (state, event, _encounterID, streamType, context) => {
    if (streamType !== "damage") return;
    
    // Filter by selected enemies if any are selected
    const { entitySelection } = context;
    if (entitySelection.enemyIds.size > 0) {
      if (!entitySelection.enemyIds.has(event.target)) return;
    }
    
    const key = event.target;
    state.set(key, (state.get(key) || 0) + event.amount);
  },
  
  render: (props: PanelRenderProps<EntityValueMap>) => (
    <EntityValueList {...props} valueLabel="Damage Taken" />
  ),
};
