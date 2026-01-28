/**
 * Healing Taken panel - React component wrapper for healing received aggregation
 */

import { HeartPulse } from "lucide-react";
import type { PanelDefinition, PanelRenderProps } from "../types";
import { unifiedHealingProcessor, type UnifiedHealingResult } from "../processors";
import { HealingTakenContent } from "./HealingTakenContent";

/**
 * Entity target types for healing taken aggregation
 */
export type HealingTargetType = "players";

interface HealingTargetConfig {
  label: string;
  icon: React.ReactNode;
}

const HEALING_TARGET_CONFIGS: Record<HealingTargetType, HealingTargetConfig> = {
  players: {
    label: "Healing Taken",
    icon: <HeartPulse className="h-4 w-4" />,
  },
};

/**
 * Create a HealingTakenPanel configured for a specific entity target type.
 */
export function createHealingTakenPanel(
  targetType: HealingTargetType
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): PanelDefinition<UnifiedHealingResult, any> {
  const config = HEALING_TARGET_CONFIGS[targetType];
  
  return {
    ...unifiedHealingProcessor,
    id: "healing_taken", // Override processor id to match registry key
    label: config.label,
    icon: config.icon,
    
    render: (props: PanelRenderProps<UnifiedHealingResult>) => {
      return <HealingTakenContent {...props} targetType={targetType} />;
    },
  };
}
