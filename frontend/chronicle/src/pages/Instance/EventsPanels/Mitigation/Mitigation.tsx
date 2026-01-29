/**
 * Mitigation panel - shows damage prevented through absorbs, resists, and blocks.
 */

import { ShieldCheck } from "lucide-react";
import type { PanelDefinition, PanelRenderProps } from "../types";
import { mitigationProcessor, type MitigationResult } from "../processors";
import { MitigationContent } from "./MitigationContent";

// Re-export for convenience
export type { MitigationViewMode } from "./MitigationContent";

/**
 * Create the MitigationPanel definition.
 */
export function createMitigationPanel(): PanelDefinition<MitigationResult, unknown> {
  return {
    ...mitigationProcessor,
    label: "Mitigation",
    icon: <ShieldCheck className="h-4 w-4" />,
    
    render: (props: PanelRenderProps<MitigationResult>) => {
      return <MitigationContent {...props} viewMode="total" />;
    },
  };
}
