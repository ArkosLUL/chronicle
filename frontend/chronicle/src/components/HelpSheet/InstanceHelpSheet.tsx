/**
 * InstanceHelpSheet - Interactive feature map for the Instance page.
 * 
 * Provides a list of page features that highlight on hover, showing
 * where each feature is located on the page with a spotlight effect.
 */

import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { HelpCircle, MousePointerClick, Users, LayoutGrid, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

// -----------------------------------------------------------------------------
// Feature Map Configuration
// -----------------------------------------------------------------------------

interface FeatureItem {
  id: string;
  label: string;
  selector: string;
  description: string;
}

interface FeatureCategory {
  title: string;
  icon: React.ReactNode;
  items: FeatureItem[];
}

const FEATURE_MAP: FeatureCategory[] = [
  {
    title: "Encounters",
    icon: <MousePointerClick className="h-4 w-4 text-blue-500" />,
    items: [
      {
        id: "encounter-sidebar",
        label: "Encounter Sidebar",
        selector: "[data-help-encounter-sidebar]",
        description: "Select encounters to analyze. Ctrl/⌘+click to select multiple. Trash encounters are grouped by mob type.",
      },
      {
        id: "quick-select",
        label: "Quick Select Buttons",
        selector: "[data-help-quick-select]",
        description: "Quickly select All, Bosses, or Trash encounters with one click.",
      },
      {
        id: "view-toggle",
        label: "View Toggle",
        selector: "[data-help-view-toggle]",
        description: "Switch between grouped (by boss/trash) and chronological view.",
      },
    ],
  },
  {
    title: "Filtering",
    icon: <Users className="h-4 w-4 text-green-500" />,
    items: [
      {
        id: "entity-panel",
        label: "Entity Panel",
        selector: "[data-help-entity-panel]",
        description: "Filter all panels by clicking enemies or players. Click class labels to toggle all players of that class.",
      },
    ],
  },
  {
    title: "Data Panels",
    icon: <LayoutGrid className="h-4 w-4 text-purple-500" />,
    items: [
      {
        id: "panel-selector",
        label: "Panel Selector",
        selector: "[data-help-panel-selector]",
        description: "Click to change what data the panel displays. Type to search for panels.",
      },
      {
        id: "per-second-toggle",
        label: "Per-Second Toggle",
        selector: "[data-help-per-second-toggle]",
        description: "Toggle between totals and rates (DPS/HPS). Shows damage or healing per second.",
      },
      {
        id: "panel-explainer",
        label: "Panel Help (?)",
        selector: "[data-help-panel-explainer]",
        description: "Click for a detailed explanation and interactive walkthrough of the panel.",
      },
    ],
  },
  {
    title: "Pro Tips",
    icon: <Lightbulb className="h-4 w-4 text-amber-500" />,
    items: [
      {
        id: "shareable-url",
        label: "Shareable URLs",
        selector: "", // No element to highlight
        description: "Copy the URL to share your exact view (encounters, panels, filters) with others.",
      },
    ],
  },
];

// -----------------------------------------------------------------------------
// Spotlight Component
// -----------------------------------------------------------------------------

function FeatureSpotlight({ 
  selector, 
  description,
}: { 
  selector: string | null;
  description: string | null;
}) {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!selector) {
      // Use timeout to avoid "setState in effect" lint warning
      // This is intentional - we need to clear rect when selector becomes null
      const timeout = setTimeout(() => setTargetRect(null), 0);
      return () => clearTimeout(timeout);
    }

    const updateRect = () => {
      const el = document.querySelector(selector);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
    };

    // Initial measurement with retries (element may be rendering)
    updateRect();
    const retry1 = setTimeout(updateRect, 50);
    const retry2 = setTimeout(updateRect, 150);

    // Scroll element into view
    const el = document.querySelector(selector);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    // Track position on scroll/resize
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);

    return () => {
      clearTimeout(retry1);
      clearTimeout(retry2);
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [selector]);

  if (!targetRect) return null;

  const padding = 6;
  
  // Smart tooltip positioning - avoid going off screen
  const tooltipWidth = 280;
  const tooltipOnRight = targetRect.right + 12 + tooltipWidth < window.innerWidth;
  const tooltipLeft = tooltipOnRight 
    ? targetRect.right + 12 
    : targetRect.left - tooltipWidth - 12;

  return createPortal(
    <>
      {/* Spotlight cutout */}
      <div
        className="fixed z-[100] pointer-events-none rounded-md transition-all duration-200"
        style={{
          left: targetRect.left - padding,
          top: targetRect.top - padding,
          width: targetRect.width + padding * 2,
          height: targetRect.height + padding * 2,
          boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.5), 0 0 0 2px #3b82f6",
        }}
      />
      
      {/* Description tooltip near element */}
      {description && (
        <div
          className="fixed z-[101] bg-card border rounded-lg p-3 shadow-lg animate-in fade-in-0 duration-150"
          style={{
            left: tooltipLeft,
            top: targetRect.top,
            width: tooltipWidth,
          }}
        >
          <p className="text-sm">{description}</p>
        </div>
      )}
    </>,
    document.body
  );
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export interface InstanceHelpSheetProps {
  /** Whether the sheet is open (controlled mode) */
  open?: boolean;
  /** Callback when open state changes (controlled mode) */
  onOpenChange?: (open: boolean) => void;
}

/**
 * Interactive feature map that highlights page elements on hover.
 * Can be used as controlled or uncontrolled component.
 */
export function InstanceHelpSheet({ open: controlledOpen, onOpenChange }: InstanceHelpSheetProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<FeatureItem | null>(null);
  
  // Use controlled or uncontrolled state
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  
  const handleOpenChange = useCallback((open: boolean) => {
    if (isControlled) {
      onOpenChange?.(open);
    } else {
      setInternalOpen(open);
    }
    // Clear hover when closing
    if (!open) {
      setHoveredItem(null);
    }
  }, [isControlled, onOpenChange]);
  
  const handleOpen = useCallback(() => {
    handleOpenChange(true);
  }, [handleOpenChange]);

  return (
    <>
      {/* Trigger button (only in uncontrolled mode) */}
      {!isControlled && (
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={handleOpen}>
          <HelpCircle className="h-4 w-4" />
          <span className="hidden sm:inline">Help</span>
        </Button>
      )}
      
      {/* Sheet */}
      <Sheet open={isOpen} onOpenChange={handleOpenChange}>
        <SheetContent side="right" className="w-80 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <span>📖</span>
              Page Guide
            </SheetTitle>
          </SheetHeader>
          
          <p className="text-xs text-muted-foreground px-4 pb-2">
            Hover over items to see where they are on the page
          </p>
          
          <div className="px-4 pb-4 space-y-6">
            {FEATURE_MAP.map(category => (
              <div key={category.title}>
                <h3 className="flex items-center gap-2 text-sm font-medium mb-2">
                  {category.icon}
                  {category.title}
                </h3>
                <ul className="space-y-0.5">
                  {category.items.map(item => (
                    <li
                      key={item.id}
                      className={`px-3 py-1.5 rounded text-sm transition-colors ${
                        item.selector 
                          ? "cursor-pointer hover:bg-muted" 
                          : "text-muted-foreground"
                      } ${hoveredItem?.id === item.id ? "bg-muted" : ""}`}
                      onMouseEnter={() => item.selector && setHoveredItem(item)}
                      onMouseLeave={() => setHoveredItem(null)}
                    >
                      {item.label}
                      {!item.selector && (
                        <span className="block text-xs text-muted-foreground mt-0.5">
                          {item.description}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
      
      {/* Spotlight overlay (rendered outside sheet to avoid z-index issues) */}
      {isOpen && (
        <FeatureSpotlight
          selector={hoveredItem?.selector ?? null}
          description={hoveredItem?.description ?? null}
        />
      )}
    </>
  );
}
