import { equipmentProcessor, type EquipmentResult } from "./equipment.processor";
import type { PanelDefinition, PanelRenderProps } from "../processorTypes";
import { Shirt } from "lucide-react";
import { EquipmentContent } from "./EquipmentContent";

export function createEquipmentPanel(): PanelDefinition<EquipmentResult> {
  return {
    ...equipmentProcessor,
    label: "Equipment",
    icon: <Shirt className="h-4 w-4" />,
    render: (props: PanelRenderProps<EquipmentResult>) => (
      <EquipmentContent {...props} />
    ),
  };
}
