import { GenericPanel } from "../GenericPanel";
import type { PanelRenderProps } from "../types";
import type { MitigationResult } from "../processors";

export type MitigationViewMode = "total" | "absorbed" | "resisted" | "blocked";

type MitigationContentProps = PanelRenderProps<MitigationResult>;

export const MitigationContent = (props: MitigationContentProps) => {
  return (
    <GenericPanel {...props}>
      <div className="flex items-center justify-center h-32 text-muted-foreground">
        <p className="text-sm">Coming soon</p>
      </div>
    </GenericPanel>
  );
}
