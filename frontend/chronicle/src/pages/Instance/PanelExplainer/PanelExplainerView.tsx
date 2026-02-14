/**
 * PanelExplainerView - Full-page explainer mode for a single panel.
 *
 * When the user clicks the ? button on a panel, this view takes over:
 * - Other panels fade away
 * - The selected panel is centered and enlarged
 * - Breakout panels are forced open
 * - Explanation text and walkthrough steps are shown below
 *
 * Mobile: This view is not shown on mobile - tooltips are used instead.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, BookOpen, Lightbulb, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card/Card";
import { PANELS, type EventsPanelType } from "../EventsPanels/EventsPanel";
import { getExplainer } from "../EventsPanels/explainers";
import { EventsPanel } from "../EventsPanels";
import type { PanelContext } from "../EventsPanels/types";

export interface PanelExplainerViewProps {
  /** The panel type being explained */
  panelType: EventsPanelType;
  /** Panel context for rendering the live panel */
  context: PanelContext;
  /** Duration in ms for per-second calculations */
  durationMs: number;
  /** Callback to exit explainer mode */
  onExit: () => void;
}

export function PanelExplainerView({
  panelType,
  context,
  durationMs,
  onExit,
}: PanelExplainerViewProps) {
  const panel = PANELS[panelType];
  const explainer = getExplainer(panelType);
  const [currentStep, setCurrentStep] = useState(0);
  const [walkthroughStarted, setWalkthroughStarted] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);

  if (!explainer) {
    // Shouldn't happen, but fallback gracefully
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={onExit}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <p className="mt-4 text-muted-foreground">
          No explainer available for this panel.
        </p>
      </div>
    );
  }

  const hasWalkthrough = explainer.walkthrough && explainer.walkthrough.length > 0;
  const currentWalkthroughStep = explainer.walkthrough?.[currentStep];
  const isLastStep = currentStep >= (explainer.walkthrough?.length ?? 0) - 1;

  const handleNextStep = () => {
    if (isLastStep) {
      setShowCompletion(true);
      // Auto-dismiss after 2 seconds
      setTimeout(() => {
        setShowCompletion(false);
        setWalkthroughStarted(false);
        setCurrentStep(0);
      }, 2000);
    } else {
      setCurrentStep((s) => s + 1);
    }
  };

  const handleStartWalkthrough = () => {
    setWalkthroughStarted(true);
    setCurrentStep(0);
  };

  const handleExitWalkthrough = useCallback(() => {
    setShowCompletion(false);
    setWalkthroughStarted(false);
    setCurrentStep(0);
  }, []);

  // Escape key to exit walkthrough
  useEffect(() => {
    if (!walkthroughStarted) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleExitWalkthrough();
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [walkthroughStarted, handleExitWalkthrough]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={onExit} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Exit Explainer
          </Button>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            {panel.icon}
            <span>{panel.label}</span>
          </h1>
          <div className="w-[140px]" /> {/* Spacer for centering */}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Summary Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                What this panel shows
              </span>
              {hasWalkthrough && (
                walkthroughStarted ? (
                  <Button size="sm" variant="outline" onClick={handleExitWalkthrough}>
                    Cancel Walkthrough
                  </Button>
                ) : (
                  <Button size="sm" onClick={handleStartWalkthrough}>
                    Start Walkthrough
                  </Button>
                )
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{explainer.summary}</p>
          </CardContent>
        </Card>

        {/* Live Panel */}
        <div className="relative">
          {/* Highlight overlay for walkthrough */}
          {walkthroughStarted && !showCompletion && currentWalkthroughStep?.highlightSelector && (
            <ExplainerHighlight 
              selector={currentWalkthroughStep.highlightSelector} 
              onExit={handleExitWalkthrough}
              onTargetClick={currentWalkthroughStep.waitFor === "click" ? handleNextStep : undefined}
              onTargetHover={currentWalkthroughStep.waitFor === "hover" ? handleNextStep : undefined}
              instruction={currentWalkthroughStep.instruction}
              stepNumber={currentStep + 1}
              totalSteps={explainer.walkthrough?.length ?? 0}
              waitFor={currentWalkthroughStep.waitFor}
            />
          )}
          
          {/* Completion overlay */}
          {showCompletion && createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
              <div 
                className="text-center animate-in fade-in zoom-in duration-300"
              >
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="text-3xl font-bold text-white mb-2">You're all set!</h2>
                <p className="text-xl text-white/80">Best of luck with your logs!</p>
                <p className="text-sm text-white/40 mt-4">Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-xs">Esc</kbd> to close</p>
              </div>
            </div>,
            document.body
          )}

          <EventsPanel
            panelType={panelType}
            onPanelTypeChange={() => {}} // Read-only in explainer mode
            durationMs={durationMs}
            context={context}
            panelIndex={0}
          />
        </div>



        {/* Tips Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {explainer.tips.map((tip, idx) => (
                <li key={idx} className="flex items-start gap-2 text-muted-foreground">
                  <span className="text-primary">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * Spotlight overlay that darkens the page and highlights the target element.
 * Uses box-shadow technique to create a "cutout" effect around the target.
 */
function ExplainerHighlight({ 
  selector, 
  onExit,
  onTargetClick,
  onTargetHover,
  instruction,
  stepNumber,
  totalSteps,
  waitFor,
}: { 
  selector: string; 
  onExit: () => void;
  onTargetClick?: () => void;
  onTargetHover?: () => void;
  instruction?: string;
  stepNumber?: number;
  totalSteps?: number;
  waitFor?: "click" | "hover" | "manual";
}) {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const hasScrolledRef = useRef(false);
  const hoverTimeoutRef = useRef<number | null>(null);

  // Reset scroll flag when selector changes
  useEffect(() => {
    hasScrolledRef.current = false;
  }, [selector]);

  // Listen for clicks on the target element
  useEffect(() => {
    if (!onTargetClick) return;
    
    let el: Element | null = null;
    let retryInterval: number | null = null;
    
    const handleClick = () => {
      onTargetClick();
    };
    
    const attachListener = () => {
      el = document.querySelector(selector);
      if (el) {
        if (retryInterval) {
          clearInterval(retryInterval);
          retryInterval = null;
        }
        el.addEventListener("click", handleClick);
      }
    };
    
    // Try immediately, then retry every 100ms
    attachListener();
    if (!el) {
      retryInterval = window.setInterval(attachListener, 100);
    }
    
    return () => {
      if (retryInterval) clearInterval(retryInterval);
      if (el) {
        el.removeEventListener("click", handleClick);
      }
    };
  }, [selector, onTargetClick]);

  // Listen for hover on the target element (with 1 second delay)
  useEffect(() => {
    if (!onTargetHover) return;
    
    let el: Element | null = null;
    let retryInterval: number | null = null;
    
    const handleMouseEnter = () => {
      hoverTimeoutRef.current = window.setTimeout(() => {
        onTargetHover();
      }, 500);
    };
    
    const handleMouseLeave = () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
    };
    
    const attachListener = () => {
      el = document.querySelector(selector);
      if (el) {
        if (retryInterval) {
          clearInterval(retryInterval);
          retryInterval = null;
        }
        el.addEventListener("mouseenter", handleMouseEnter);
        el.addEventListener("mouseleave", handleMouseLeave);
      }
    };
    
    // Try immediately, then retry every 100ms
    attachListener();
    if (!el) {
      retryInterval = window.setInterval(attachListener, 100);
    }
    
    return () => {
      if (retryInterval) clearInterval(retryInterval);
      if (el) {
        el.removeEventListener("mouseenter", handleMouseEnter);
        el.removeEventListener("mouseleave", handleMouseLeave);
      }
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, [selector, onTargetHover]);

  const updateRect = useCallback(() => {
    const el = document.querySelector(selector);
    if (el) {
      // Scroll element into view on first find
      if (!hasScrolledRef.current) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        hasScrolledRef.current = true;
        // Wait for scroll to finish before measuring
        setTimeout(() => {
          setTargetRect(el.getBoundingClientRect());
        }, 300);
      } else {
        setTargetRect(el.getBoundingClientRect());
      }
    } else {
      setTargetRect(null);
    }
  }, [selector]);

  useEffect(() => {
    // Initial update with retries - element may not exist yet if panel is still rendering
    updateRect();
    const retryTimeout1 = setTimeout(updateRect, 50);
    const retryTimeout2 = setTimeout(updateRect, 150);
    const retryTimeout3 = setTimeout(updateRect, 500);
    
    // Update on scroll/resize since getBoundingClientRect is viewport-relative
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);
    
    return () => {
      clearTimeout(retryTimeout1);
      clearTimeout(retryTimeout2);
      clearTimeout(retryTimeout3);
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [updateRect]);

  if (!targetRect) {
    // Element not found - don't show anything
    return null;
  }

  const padding = 6;

  return createPortal(
    <>
      {/* Instruction banner at top */}
      {instruction && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 max-w-xl pointer-events-none" style={{ zIndex: 60 }}>
          <div 
            className="bg-primary/95 text-white px-8 py-5 rounded-xl text-center border border-blue-500/50"
            style={{ boxShadow: "0 0 30px 5px rgba(59, 130, 246, 0.3)" }}
          >
            <p className="text-xl font-medium">{instruction}</p>
            {stepNumber && totalSteps && (
              <p className="text-sm text-blue-300 mt-2">
                Step {stepNumber} of {totalSteps}
              </p>
            )}
            {waitFor === "hover" && (
              <p className="text-xs text-white/50 mt-3">
                Hover on the highlighted area to continue
              </p>
            )}
            {waitFor === "click" && (
              <p className="text-xs text-white/50 mt-3">
                Click the highlighted area to continue
              </p>
            )}
          </div>
        </div>
      )}
      {/* Spotlight cutout */}
      <div
        className="fixed z-50 pointer-events-none rounded-md"
        style={{
          left: targetRect.left - padding,
          top: targetRect.top - padding,
          width: targetRect.width + padding * 2,
          height: targetRect.height + padding * 2,
          boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.6), 0 0 0 2px #3b82f6",
        }}
      />
      {/* Exit button in top-right */}
      <button
        onClick={onExit}
        className="fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg bg-black/80 text-white hover:bg-black/90 transition-colors cursor-pointer animate-[glow-pulse_2s_ease-in-out_infinite]"
        style={{
          animationName: "glow-pulse",
        }}
      >
      <style>{`
        @keyframes glow-pulse {
          0%, 100% { box-shadow: 0 0 20px 4px rgba(239, 68, 68, 0.6); }
          50% { box-shadow: 0 0 30px 8px rgba(239, 68, 68, 0.8); }
        }
      `}</style>
        <span className="text-base">
          Press <kbd className="px-2 py-1 rounded bg-white/20 font-mono text-sm">Esc</kbd> to exit
        </span>
        <X className="h-5 w-5" />
      </button>
    </>,
    document.body
  );
}
