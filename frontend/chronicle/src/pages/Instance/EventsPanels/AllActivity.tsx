/**
 * All Activity panel - React component wrapper for event counting
 */

import { Activity } from "lucide-react";
import type { PanelDefinition, PanelRenderProps, EntityValueMap } from "./types";
import { EntityValueList } from "./EntityValueList";
import { allActivityProcessor, type AllActivityState } from "./processors";

export const AllActivityPanel: PanelDefinition<AllActivityState> = {
  ...allActivityProcessor,
  label: "All Activity",
  icon: <Activity className="h-4 w-4" />,
  
  render: (props: PanelRenderProps<EntityValueMap>) => (
    <EntityValueList {...props} valueLabel="Events" />
  ),
};
