/**
 * Damage Done panel - React component wrapper for damage aggregation
 */

import { Swords } from "lucide-react";
import type { PanelDefinition, PanelRenderProps } from "../types";
import { damageDoneProcessor, type DamageDoneState } from "../processors";
import { DamageDoneContent } from "./DamageDoneContent";
import type { PlayerMetricChartData } from "@/components/ui/PlayerMetricChart/PlayerMetricChart";

// Re-export as PlayerMetricChartMap for backward compatibility
export type PlayerMetricChartMap = Map<string, PlayerMetricChartData>;

export const DamageDonePanel: PanelDefinition<DamageDoneState> = {
  ...damageDoneProcessor,
  label: "Damage Done",
  icon: <Swords className="h-4 w-4" />,
  
  render: (props: PanelRenderProps<DamageDoneState>) => {
    return <DamageDoneContent {...props} />;
  }
};
