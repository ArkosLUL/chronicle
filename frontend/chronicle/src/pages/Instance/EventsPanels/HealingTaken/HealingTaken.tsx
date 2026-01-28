/**
 * Healing Taken panel - React component wrapper for healing received aggregation
 */

import { HeartPulse } from "lucide-react";
import type { PanelDefinition, PanelRenderProps } from "../types";
import { 
  healingTakenProcessor,
  type HealingTakenResult 
} from "./healingTaken.processor";
import { HealingTakenContent } from "./HealingTakenContent";
import type { HealingTargetType } from "./healingTaken.processor";

// Re-export for convenience
export type { HealingTargetType } from "./healingTaken.processor";

interface HealingTargetConfig {
  label: string;
  icon: React.ReactNode;
  processor: typeof healingTakenProcessor;
}

const HEALING_TARGET_CONFIGS: Record<HealingTargetType, HealingTargetConfig> = {
  players: {
    label: "Healing Taken",
    icon: <HeartPulse className="h-4 w-4" />,
    processor: healingTakenProcessor,
  },
};

/**
 * Create a HealingTakenPanel configured for a specific entity target type.
 */
export function createHealingTakenPanel(
  targetType: HealingTargetType
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): PanelDefinition<HealingTakenResult, any> {
  const config = HEALING_TARGET_CONFIGS[targetType];
  
  return {
    ...config.processor,
    label: config.label,
    icon: config.icon,
    
    render: (props: PanelRenderProps<HealingTakenResult>) => {
      return <HealingTakenContent {...props} targetType={targetType} />;
    },
  };
}
