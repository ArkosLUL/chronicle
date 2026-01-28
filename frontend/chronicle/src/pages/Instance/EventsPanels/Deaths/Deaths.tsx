/**
 * Deaths panel - React component wrapper for player death tracking
 */

import { Skull } from "lucide-react";
import type { PanelDefinition, PanelRenderProps } from "../types";
import { deathsProcessor, type DeathsResult } from "./deaths.processor";
import { DeathsContent } from "./DeathsContent";

/**
 * Create the Deaths panel definition.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDeathsPanel(): PanelDefinition<DeathsResult, any> {
  return {
    ...deathsProcessor,
    label: "Deaths",
    icon: <Skull className="h-4 w-4" />,

    render: (props: PanelRenderProps<DeathsResult>) => {
      return <DeathsContent {...props} />;
    },
  };
}
