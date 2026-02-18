import { Menu, LayoutGrid, Rows3, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/DropdownMenu/DropdownMenu";
import type { LayoutType } from "@/hooks/useUrlState";

interface InstanceMenuProps {
  layout: LayoutType;
  onLayoutChange: (layout: LayoutType) => void;
  logDetailUrl?: string;
}

export function InstanceMenu({ layout, onLayoutChange, logDetailUrl }: InstanceMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <Menu className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {/* Layout section */}
        <DropdownMenuLabel className="text-xs text-muted-foreground">Layout</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={layout} onValueChange={(v) => onLayoutChange(v as LayoutType)}>
          <DropdownMenuRadioItem value="standard">
            <LayoutGrid className="h-4 w-4 mr-2" />
            Standard (2×2 + 1)
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="alternate">
            <Rows3 className="h-4 w-4 mr-2" />
            Alternate (1+1 + 2×1)
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        
        {logDetailUrl && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to={logDetailUrl}>
                <FileText className="h-4 w-4 mr-2" />
                View Log
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
