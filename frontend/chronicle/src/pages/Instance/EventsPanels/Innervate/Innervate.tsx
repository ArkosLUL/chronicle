/**
 * Innervate panel - Shows Innervate casts by Druids.
 * 
 * Displays a simple table of who cast Innervate on whom.
 */

import { Leaf } from "lucide-react";
import type { PanelDefinition, PanelRenderProps } from "../types";
import { innervateProcessor, type InnervateResult } from "./innervate.processor";
import { GenericPanel } from "../GenericPanel";

/**
 * Format milliseconds to MM:SS format
 */
function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Create the Innervate panel definition.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createInnervatePanel(): PanelDefinition<InnervateResult, any> {
  return {
    ...innervateProcessor,
    label: "Innervate",
    icon: <Leaf className="h-4 w-4" />,
    supportsPerSecond: false,
    
    render: (props: PanelRenderProps<InnervateResult>) => {
      return <InnervateContent {...props} />;
    },
  };
}

function InnervateContent(props: PanelRenderProps<InnervateResult>) {
  const { result } = props;
  const hasCasts = result !== null && result.casts.length > 0;
  
  return (
    <GenericPanel {...props}>
      {!hasCasts ? (
        <div className="text-center py-2 text-muted-foreground text-sm">
          No Innervate casts found
        </div>
      ) : (
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground mb-2">
            {result.casts.length} Innervate cast{result.casts.length !== 1 ? "s" : ""}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b">
                <th className="text-left py-1 font-medium">Time</th>
                <th className="text-left py-1 font-medium">Caster</th>
                <th className="text-left py-1 font-medium">Target</th>
              </tr>
            </thead>
            <tbody>
              {result.casts.map((cast, idx) => (
                <tr key={idx} className="border-b border-border/50 last:border-0">
                  <td className="py-1.5 text-muted-foreground font-mono text-xs">
                    {formatTime(cast.offsetMilli)}
                  </td>
                  <td className="py-1.5">
                    {cast.casterName}
                  </td>
                  <td className="py-1.5">
                    {cast.targetName}
                    {cast.casterGuid === cast.targetGuid && (
                      <span className="text-xs text-muted-foreground ml-1">(self)</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GenericPanel>
  );
}
