/**
 * All Activity panel - counts all events by caster across all streams
 */

import { Activity } from "lucide-react";
import type { PanelDefinition, PanelRenderProps, EntityValueMap } from "./types";
import { EntityValueList } from "./EntityValueList";

export const AllActivityPanel: PanelDefinition<EntityValueMap> = {
  id: "all_activity",
  label: "All Activity",
  icon: <Activity className="h-4 w-4" />,
  streams: ["damage", "heal", "resource_change"],
  
  createState: () => new Map<string, number>(),
  
  processEvent: (state, event, _encounterID, _streamType, context) => {
    // Filter by selected players if any are selected
    const { entitySelection } = context;
    if (entitySelection.playerIds.size > 0) {
      if (!entitySelection.playerIds.has(event.caster)) return;
    }
    
    // Count events, not amounts
    const key = event.caster || "Unknown";
    state.set(key, (state.get(key) || 0) + 1);
  },
  
  render: (props: PanelRenderProps<EntityValueMap>) => (
    <EntityValueList {...props} valueLabel="Events" />
  ),
};
