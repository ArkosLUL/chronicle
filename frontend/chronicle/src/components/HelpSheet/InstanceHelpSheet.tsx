/**
 * InstanceHelpSheet - A modal overlay with tips and shortcuts for the Instance page.
 * 
 * Provides a comprehensive reference for all Instance page features,
 * organized by category. Closes on Esc or clicking outside.
 */

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { HelpCircle, MousePointerClick, Users, LayoutGrid, Keyboard, Lightbulb, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/Card/Card";

interface HelpSectionProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

function HelpSection({ icon, title, children }: HelpSectionProps) {
  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 font-medium text-sm">
        {icon}
        {title}
      </h3>
      <ul className="space-y-1.5 text-sm text-muted-foreground ml-6">
        {children}
      </ul>
    </div>
  );
}

function HelpItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="text-primary mt-0.5">•</span>
      <span>{children}</span>
    </li>
  );
}

export interface InstanceHelpSheetProps {
  /** Whether the overlay is open (controlled mode) */
  open?: boolean;
  /** Callback when open state changes (controlled mode) */
  onOpenChange?: (open: boolean) => void;
}

/**
 * Help overlay that can be used as a controlled or uncontrolled component.
 * When used uncontrolled, it renders its own trigger button and manages state.
 * Closes on Esc key or clicking the backdrop.
 */
export function InstanceHelpSheet({ open: controlledOpen, onOpenChange }: InstanceHelpSheetProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  
  // Use controlled or uncontrolled state
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  
  const handleClose = useCallback(() => {
    if (isControlled) {
      onOpenChange?.(false);
    } else {
      setInternalOpen(false);
    }
  }, [isControlled, onOpenChange]);
  
  const handleOpen = useCallback(() => {
    if (isControlled) {
      onOpenChange?.(true);
    } else {
      setInternalOpen(true);
    }
  }, [isControlled, onOpenChange]);
  
  // Handle Esc key
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);
  
  return (
    <>
      {/* Trigger button (only in uncontrolled mode) */}
      {!isControlled && (
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={handleOpen}>
          <HelpCircle className="h-4 w-4" />
          <span className="hidden sm:inline">Help</span>
        </Button>
      )}
      
      {/* Modal overlay */}
      {isOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 animate-in fade-in-0 duration-200"
            onClick={handleClose}
          />
          
          {/* Content */}
          <Card className="relative z-10 w-full max-w-lg max-h-[80vh] overflow-y-auto p-6 animate-in fade-in-0 zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <HelpCircle className="h-5 w-5" />
                Tips & Shortcuts
              </h2>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleClose}>
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>

            <div className="space-y-6">
          <HelpSection
            icon={<MousePointerClick className="h-4 w-4 text-blue-500" />}
            title="Encounters"
          >
            <HelpItem>
              <kbd className="px-1 py-0.5 text-xs bg-muted rounded">Ctrl</kbd>/<kbd className="px-1 py-0.5 text-xs bg-muted rounded">⌘</kbd>+click to select multiple encounters
            </HelpItem>
            <HelpItem>
              Use <strong>All</strong>, <strong>Bosses</strong>, <strong>Trash</strong> buttons for quick selection
            </HelpItem>
            <HelpItem>
              Click the view toggle to switch between grouped and chronological order
            </HelpItem>
            <HelpItem>
              Trash encounters are grouped by mob type for easier navigation
            </HelpItem>
          </HelpSection>

          <HelpSection
            icon={<Users className="h-4 w-4 text-green-500" />}
            title="Entity Filtering"
          >
            <HelpItem>
              Click players or enemies to filter <strong>all</strong> panels to that selection
            </HelpItem>
            <HelpItem>
              Click class labels (e.g., <span className="font-mono text-xs">WAR:</span>) to toggle all players of that class
            </HelpItem>
            <HelpItem>
              Use <strong>Clear</strong> to reset entity selection and see all data
            </HelpItem>
            <HelpItem>
              <strong>Select Bosses</strong> quick-link filters to boss enemies only
            </HelpItem>
          </HelpSection>

          <HelpSection
            icon={<LayoutGrid className="h-4 w-4 text-purple-500" />}
            title="Panels"
          >
            <HelpItem>
              Click the panel dropdown to change what data is displayed
            </HelpItem>
            <HelpItem>
              Click <HelpCircle className="h-3 w-3 inline" /> on any panel for a detailed explanation
            </HelpItem>
            <HelpItem>
              Toggle <strong>Per Second</strong> to see rates instead of totals (DPS/HPS)
            </HelpItem>
            <HelpItem>
              Click any row to see ability and target breakdowns
            </HelpItem>
            <HelpItem>
              Search for panels by typing in the selector dropdown
            </HelpItem>
          </HelpSection>

          <HelpSection
            icon={<Keyboard className="h-4 w-4 text-orange-500" />}
            title="Keyboard Shortcuts"
          >
            <HelpItem>
              <kbd className="px-1 py-0.5 text-xs bg-muted rounded">Ctrl</kbd>/<kbd className="px-1 py-0.5 text-xs bg-muted rounded">⌘</kbd>+click for multi-select
            </HelpItem>
            <HelpItem>
              Press <kbd className="px-1 py-0.5 text-xs bg-muted rounded">Esc</kbd> to close popups and dropdowns
            </HelpItem>
          </HelpSection>

          <HelpSection
            icon={<Lightbulb className="h-4 w-4 text-amber-500" />}
            title="Pro Tips"
          >
            <HelpItem>
              URLs are shareable - copy the URL to share your exact view with others
            </HelpItem>
            <HelpItem>
              Multi-selecting encounters shows combined metrics across all selected fights
            </HelpItem>
            <HelpItem>
              Compare wipe attempts by selecting them together to spot improvement
            </HelpItem>
            <HelpItem>
              Look for the <HelpCircle className="h-3 w-3 inline text-muted-foreground" /> icons for contextual tips throughout the page
            </HelpItem>
          </HelpSection>
            </div>
          </Card>
        </div>,
        document.body
      )}
    </>
  );
}
