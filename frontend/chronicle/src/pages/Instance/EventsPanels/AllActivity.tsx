/**
 * All Activity panel - React component wrapper for event counting
 */

import { Activity } from "lucide-react";
import type { PanelDefinition, PanelRenderProps, EntityValueMap } from "./types";
import { EntityValueList } from "./EntityValueList";
import { allActivityProcessor, type AllActivityState } from "./processors";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const AllActivityPanel: PanelDefinition<AllActivityState, any> = {
  ...allActivityProcessor,
  label: "All Activity",
  icon: <Activity className="h-4 w-4" />,
  
  render: (props: PanelRenderProps<EntityValueMap>) => (
    <EntityValueList {...props} valueLabel="Events" />
  ),
};
