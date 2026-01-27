/**
 * EventsPanel - Container component for event aggregation panels
 */

import { useState } from "react";
import { Card } from "@/components/ui/Card/Card";
import { usePanelAggregation } from "./usePanelAggregation";
import type { PanelDefinition, PanelContext } from "./types";

// Import panel definitions
import { DamageDonePanel } from "./DamageDone";
import { DamageTakenPanel } from "./DamageTaken";
import { HealingDonePanel } from "./HealingDone";
import { AllActivityPanel } from "./AllActivity";

// Registry of all available panels
// Using `any` here to allow different result types per panel.
// Type safety is maintained within each panel definition.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PANELS: Record<string, PanelDefinition<any>> = {
  damage_done: DamageDonePanel,
  damage_taken: DamageTakenPanel,
  healing_done: HealingDonePanel,
  all_activity: AllActivityPanel,
};

export type EventsPanelType = keyof typeof PANELS;

const PANEL_OPTIONS: { value: EventsPanelType; label: string }[] = [
  { value: "damage_done", label: "Damage Done" },
  { value: "damage_taken", label: "Damage Taken" },
  { value: "healing_done", label: "Healing Done" },
  { value: "all_activity", label: "All Activity" },
];

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
    <Card className="p-4 gap-2">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-medium flex items-center gap-2">
          {panel.icon}
          <select
            value={panelType}
            onChange={(e) => onPanelTypeChange(e.target.value as EventsPanelType)}
            className="text-sm font-medium bg-transparent cursor-pointer hover:text-muted-foreground"
          >
            {PANEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
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
