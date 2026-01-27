/**
 * Damage Done panel - React component wrapper for damage aggregation
 * 
 * Configurable to show damage from Players, Enemies, or Pets.
 */

import { Swords, Skull, PawPrint } from "lucide-react";
import type { PanelDefinition, PanelRenderProps } from "../types";
import { damageDoneProcessor, type DamageDoneState } from "../processors";
import { DamageDoneContent } from "./DamageDoneContent";


/**
 * Entity source types for damage done panel
 */
export type DamageSourceType = "players" | "enemies" | "pets";

interface DamageSourceConfig {
  label: string;
  icon: React.ReactNode;
}

const DAMAGE_SOURCE_CONFIGS: Record<DamageSourceType, DamageSourceConfig> = {
  players: {
    label: "Damage Done",
    icon: <Swords className="h-4 w-4" />,
  },
  enemies: {
    label: "Enemy Damage",
    icon: <Skull className="h-4 w-4" />,
  },
  pets: {
    label: "Pet Damage",
    icon: <PawPrint className="h-4 w-4" />,
  },
};

/**
 * Create a DamageDonePanel configured for a specific entity source type.
 */
export function createDamageDonePanel(
  sourceType: DamageSourceType
): PanelDefinition<DamageDoneState> {
  const config = DAMAGE_SOURCE_CONFIGS[sourceType];
  
  return {
    ...damageDoneProcessor,
    // Keep processor ID as 'damage_done' - sourceType only affects rendering
    label: config.label,
    icon: config.icon,
    
    render: (props: PanelRenderProps<DamageDoneState>) => {
      return <DamageDoneContent {...props} sourceType={sourceType} />;
    },
  };
}
