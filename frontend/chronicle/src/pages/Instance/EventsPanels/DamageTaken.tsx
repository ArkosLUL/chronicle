/**
 * Damage Taken panel - React component wrapper for damage taken aggregation
 */

import { Shield } from "lucide-react";
import type { PanelDefinition, PanelRenderProps, EntityValueMap } from "./types";
import { EntityValueList } from "./EntityValueList";
import { damageTakenProcessor, type DamageTakenState } from "./processors";

export const DamageTakenPanel: PanelDefinition<DamageTakenState> = {
  ...damageTakenProcessor,
  label: "Damage Taken",
  icon: <Shield className="h-4 w-4" />,
  
  render: (props: PanelRenderProps<EntityValueMap>) => (
    <EntityValueList {...props} valueLabel="Damage Taken" />
  ),
};
