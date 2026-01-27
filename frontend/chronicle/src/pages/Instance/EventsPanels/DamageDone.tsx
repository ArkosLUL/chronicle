/**
 * Damage Done panel - aggregates damage by caster
 */

import { Swords } from "lucide-react";
import type { PanelDefinition, PanelRenderProps, PlayerMetricChartMap } from "./types";
import { PlayerMetricChart, type PlayerMetricChartData } from "@/components/ui/PlayerMetricChart/PlayerMetricChart";

export const DamageDonePanel: PanelDefinition<PlayerMetricChartMap> = {
  id: "damage_done",
  label: "Damage Done",
  icon: <Swords className="h-4 w-4" />,
  streams: ["damage"],
  
  createState: () => new Map<string, PlayerMetricChartData>(),
  
  processEvent: (state, event, _encounterID, streamType) => {
    // Only process damage events
    if (streamType !== "damage") return;
    if (!event.caster) return;
    
    const existing: PlayerMetricChartData= state.get(event.caster) || { 
      playerID: event.caster,
      value: 0,
      playerName: "",
      className: "UNKNOWN",
      specialization: "",
    };
    existing.value += event.amount;
    state.set(event.caster, existing);
  },
  
  render: (props: PanelRenderProps<PlayerMetricChartMap>) => {
    console.log(props.result)
    return <PlayerMetricChart 
      data={Array.from(props.result.values())} 
      type={"damage"} 
      panelTitle="Damage Done"
      duration_millis={props.durationMs}
    />
  },
};
