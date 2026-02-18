/**
 * LayoutSwitcher - Toggle between standard and alternate panel layouts
 */

import { LayoutGrid, Rows3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/Tooltip/tooltip";
import type { LayoutType } from "@/hooks/useUrlState";

interface LayoutSwitcherProps {
  layout: LayoutType;
  onLayoutChange: (layout: LayoutType) => void;
}

export function LayoutSwitcher({ layout, onLayoutChange }: LayoutSwitcherProps) {
  return (
    <div className="flex gap-0.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={layout === "standard" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onLayoutChange("standard")}
            className="h-7 w-7 p-0"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Standard layout (2×2 + 1 full-width)
        </TooltipContent>
      </Tooltip>
      
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={layout === "alternate" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onLayoutChange("alternate")}
            className="h-7 w-7 p-0"
          >
            <Rows3 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Alternate layout (1+1 + 2 full-width)
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
