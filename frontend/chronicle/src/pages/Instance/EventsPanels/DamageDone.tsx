/**
 * Damage Done panel - React component wrapper for damage aggregation
 */

import { Swords } from "lucide-react";
import type { PanelDefinition, PanelRenderProps } from "./types";
import { PlayerMetricChart, type PlayerMetricChartData } from "@/components/ui/PlayerMetricChart/PlayerMetricChart";
import { GenericPanel } from "./GenericPanel";
import { damageDoneProcessor, type DamageDoneState } from "./processors";

// Re-export as PlayerMetricChartMap for backward compatibility
export type PlayerMetricChartMap = Map<string, PlayerMetricChartData>;

export const DamageDonePanel: PanelDefinition<DamageDoneState> = {
  ...damageDoneProcessor,
  label: "Damage Done",
  icon: <Swords className="h-4 w-4" />,
  
  render: (props: PanelRenderProps<DamageDoneState>) => {
    return <GenericPanel {...props}>
      <PlayerMetricChart 
        data={Array.from(props.result.values())} 
        type={"damage"} 
        panelTitle="Damage Done"
        duration_millis={props.durationMs}
        perSecond={props.perSecond}
      />
    </GenericPanel>
  }
};
