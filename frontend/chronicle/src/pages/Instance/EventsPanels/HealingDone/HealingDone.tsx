/**
 * Healing Done panel - React component wrapper for healing aggregation
 */

import { Heart } from "lucide-react";
import type { PanelDefinition, PanelRenderProps } from "../types";
import { 
  healingDoneProcessor,
  type HealingDoneResult 
} from "./healingDone.processor";
import { HealingDoneContent } from "./HealingDoneContent";
import type { HealingSourceType } from "./healingDone.processor";

// Re-export for convenience
export type { HealingSourceType } from "./healingDone.processor";

interface HealingSourceConfig {
  label: string;
  icon: React.ReactNode;
  processor: typeof healingDoneProcessor;
}

const HEALING_SOURCE_CONFIGS: Record<HealingSourceType, HealingSourceConfig> = {
  players: {
    label: "Healing Done",
    icon: <Heart className="h-4 w-4" />,
    processor: healingDoneProcessor,
  },
};

/**
 * Create a HealingDonePanel configured for a specific entity source type.
 */
export function createHealingDonePanel(
  sourceType: HealingSourceType
): PanelDefinition<HealingDoneResult> {
  const config = HEALING_SOURCE_CONFIGS[sourceType];
  
  return {
    ...config.processor,
    label: config.label,
    icon: config.icon,
    
    render: (props: PanelRenderProps<HealingDoneResult>) => {
      return <HealingDoneContent {...props} sourceType={sourceType} />;
    },
  };
}
