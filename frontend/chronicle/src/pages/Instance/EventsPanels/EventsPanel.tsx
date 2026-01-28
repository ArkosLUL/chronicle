/**
 * EventsPanel - Container component for event aggregation panels
 */

import { useState } from "react";
import { Card } from "@/components/ui/Card/Card";
import { usePanelAggregation } from "./usePanelAggregation";
import type { PanelDefinition, PanelContext } from "./types";
import { PanelSelector } from "./PanelSelector";

// Import panel definitions
import { createDamageDonePanel } from "./DamageDone/DamageDone";
import { createDamageTakenPanel } from "./DamageTaken/DamageTaken";
import { createHealingDonePanel } from "./HealingDone/HealingDone";
import { createExtraAttacksPanel } from "./ExtraAttacks/ExtraAttacks";
import { createHealingTakenPanel } from "./HealingTaken/HealingTaken";
import { createDeathsPanel } from "./Deaths/Deaths";
import { createDeathLogPanel } from "./Deaths/DeathLog";
import { AllActivityPanel } from "./AllActivity";
import { AllActivityDebugPanel } from "./AllActivityDebug";

// Registry of all available panels
// Using `any` here to allow different result types per panel.
// Type safety is maintained within each panel definition.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PANELS: Record<string, PanelDefinition<any, any>> = {
  damage_done: createDamageDonePanel("players"),
  enemy_damage_done: createDamageDonePanel("enemies"),
  pet_damage_done: createDamageDonePanel("pets"),
  damage_taken: createDamageTakenPanel("players"),
  enemy_damage_taken: createDamageTakenPanel("enemies"),
  healing_done: createHealingDonePanel("players"),
  healing_taken: createHealingTakenPanel("players"),
  extra_attacks: createExtraAttacksPanel(),
  deaths: createDeathsPanel(),
  death_log: createDeathLogPanel(),
  all_activity: AllActivityPanel,
  all_activity_debug: AllActivityDebugPanel,
};

export type EventsPanelType = keyof typeof PANELS;

export interface EventsPanelProps {
  panelType: EventsPanelType;
  onPanelTypeChange: (type: EventsPanelType) => void;
  durationMs: number;
  context: PanelContext;
}

export function EventsPanel({
  panelType,
  onPanelTypeChange,
  durationMs,
  context,
}: EventsPanelProps) {
  const [perSecond, setPerSecond] = useState(false);
  const panel = PANELS[panelType];

  const {
    loading,
    processing,
    error,
    result,
    totalEvents,
    processingTimeMs,
  } = usePanelAggregation({
    panel,
    context,
  });

  return (
    <Card className="p-4 gap-2 mb-3">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <PanelSelector value={panelType} onChange={onPanelTypeChange} />
        </h3>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            <input
              type="checkbox"
              checked={perSecond}
              onChange={(e) => setPerSecond(e.target.checked)}
              className="w-3.5 h-3.5 cursor-pointer"
            />
            Per second
          </label>
        </div>
      </div>

      {/* Render the panel content */}
      {panel.render({
        result,
        totalEvents,
        processingTimeMs,
        durationMs,
        perSecond,
        loading,
        processing,
        error,
        context,
      })}
    </Card>
  );
}
