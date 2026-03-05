import { Menu, FileText, Copy, Upload } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/DropdownMenu/DropdownMenu";
interface InstanceMenuProps {
  onImportLayout?: () => void;
  instanceId: string;
  logDetailUrl?: string;
}

export function InstanceMenu({
  onImportLayout,
  instanceId,
  logDetailUrl,
}: InstanceMenuProps) {
  const handleCopyInstanceId = async () => {
    try {
      await navigator.clipboard.writeText(instanceId);
      toast.success("Copied instance ID", { description: instanceId });
    } catch {
      toast.error("Failed to copy instance ID");
    }
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <Menu className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {/* Layout section */}
        <DropdownMenuLabel className="text-xs text-muted-foreground">Actions</DropdownMenuLabel>
        {onImportLayout && (
          <DropdownMenuItem onClick={onImportLayout}>
            <Upload className="h-4 w-4 mr-2" />
            Import Layout
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleCopyInstanceId}>
          <Copy className="h-4 w-4 mr-2" />
          Copy Instance ID
        </DropdownMenuItem>

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
