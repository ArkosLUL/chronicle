/**
 * Damage Done panel - aggregates damage by caster
 */

import { Swords } from "lucide-react";
import type { PanelDefinition, PanelRenderProps, PlayerMetricChartMap } from "./types";
import { PlayerMetricChart, type PlayerMetricChartData } from "@/components/ui/PlayerMetricChart/PlayerMetricChart";
import { GUID } from "@/lib/guid/guid";
import { GenericPanel } from "./GenericPanel";

export const DamageDonePanel: PanelDefinition<PlayerMetricChartMap> = {
  id: "damage_done",
  label: "Damage Done",
  icon: <Swords className="h-4 w-4" />,
  streams: ["damage"],
  
  createState: () => new Map<string, PlayerMetricChartData>(),
  
  processEvent: (state, event, _encounterID, streamType, context) => {
    // Only process damage events
    if (streamType !== "damage") return;
    if (!event.caster) return;
    if (!GUID.fromString(event.caster).isPlayer()) return;
    
    // Filter by selected players if any are selected
    // const { entitySelection } = context;
    // if (entitySelection.playerIds.size > 0) {
    //   if (!entitySelection.playerIds.has(event.caster)) return;
    // }
    
    const existing: PlayerMetricChartData = state.get(event.caster) || { 
      playerID: event.caster,
      value: 0,
      playerName: context.instance.players?.[event.caster]?.name || "",
      className: context.instance.players?.[event.caster]?.class || "UNKNOWN",
      specialization: "",
    };
    existing.value += event.amount;
    state.set(event.caster, existing);
  },
  
  render: (props: PanelRenderProps<PlayerMetricChartMap>) => {
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
