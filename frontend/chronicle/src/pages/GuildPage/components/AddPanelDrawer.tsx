import { getAllPanelTypes } from "../panels/registry";
import { Plus } from "lucide-react";

interface AddPanelDrawerProps {
  onAddPanel: (panelType: string) => void;
}

export function AddPanelDrawer({ onAddPanel }: AddPanelDrawerProps) {
  const panelTypes = getAllPanelTypes();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mr-1">
        Add:
      </span>
      {panelTypes.map(({ type, definition }) => (
        <button
          key={type}
          onClick={() => onAddPanel(type)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border hover:border-primary hover:bg-muted/50 transition-colors text-sm"
          title={definition.description}
        >
          <span className="text-muted-foreground">{definition.icon}</span>
          <span className="font-medium">{definition.label}</span>
          <Plus className="h-3 w-3 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
}
