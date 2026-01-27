/**
 * PanelSelector - Dropdown with submenus and fuzzy search for panel selection
 */

import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, ChevronRight, Search, Swords, Skull, PawPrint, Shield, Heart, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EventsPanelType } from "./EventsPanel";

interface PanelOption {
  value: EventsPanelType;
  label: string;
  icon: React.ReactNode;
}

interface PanelCategory {
  label: string;
  icon: React.ReactNode;
  items: PanelOption[];
}

// Organize panels into categories with icons
const PANEL_CATEGORIES: PanelCategory[] = [
  {
    label: "Damage",
    icon: <Swords className="size-4" />,
    items: [
      { value: "damage_done", label: "Damage Done", icon: <Swords className="size-4" /> },
      { value: "enemy_damage_done", label: "Enemy Damage Done", icon: <Skull className="size-4" /> },
      { value: "pet_damage_done", label: "Pet Damage Done", icon: <PawPrint className="size-4" /> },
      { value: "damage_taken", label: "Damage Taken", icon: <Shield className="size-4" /> },
    ],
  },
  {
    label: "Healing",
    icon: <Heart className="size-4" />,
    items: [{ value: "healing_done", label: "Healing Done", icon: <Heart className="size-4" /> }],
  },
  {
    label: "Activity",
    icon: <Activity className="size-4" />,
    items: [{ value: "all_activity", label: "All Activity", icon: <Activity className="size-4" /> }],
  },
];

// Flatten for lookup
const ALL_PANELS: PanelOption[] = PANEL_CATEGORIES.flatMap((cat) => cat.items);

function getPanelForValue(value: EventsPanelType): PanelOption | undefined {
  return ALL_PANELS.find((p) => p.value === value);
}

/**
 * Simple fuzzy match - checks if all characters in pattern appear in str in order
 */
function fuzzyMatch(pattern: string, str: string): { match: boolean; score: number } {
  const patternLower = pattern.toLowerCase();
  const strLower = str.toLowerCase();

  if (patternLower.length === 0) return { match: true, score: 0 };

  let patternIdx = 0;
  let score = 0;
  let consecutiveBonus = 0;

  for (let i = 0; i < strLower.length && patternIdx < patternLower.length; i++) {
    if (strLower[i] === patternLower[patternIdx]) {
      // Bonus for consecutive matches
      score += 1 + consecutiveBonus;
      consecutiveBonus += 1;
      // Bonus for matching at word start
      if (i === 0 || str[i - 1] === " ") {
        score += 2;
      }
      patternIdx++;
    } else {
      consecutiveBonus = 0;
    }
  }

  return {
    match: patternIdx === patternLower.length,
    score,
  };
}

export interface PanelSelectorProps {
  value: EventsPanelType;
  onChange: (value: EventsPanelType) => void;
  className?: string;
}

export function PanelSelector({ value, onChange, className }: PanelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
        setExpandedCategory(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Filter panels based on search
  const filteredResults = useMemo(() => {
    if (!searchQuery.trim()) return null;

    const results: { option: PanelOption; category: string; score: number }[] = [];

    for (const category of PANEL_CATEGORIES) {
      for (const item of category.items) {
        const { match, score } = fuzzyMatch(searchQuery, item.label);
        if (match) {
          results.push({ option: item, category: category.label, score });
        }
      }
    }

    // Sort by score descending
    return results.sort((a, b) => b.score - a.score);
  }, [searchQuery]);

  const handleSelect = (panelValue: EventsPanelType) => {
    onChange(panelValue);
    setIsOpen(false);
    setSearchQuery("");
    setExpandedCategory(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      setSearchQuery("");
      setExpandedCategory(null);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-sm font-medium bg-transparent cursor-pointer hover:text-muted-foreground transition-colors"
      >
        {getPanelForValue(value)?.icon}
        {getPanelForValue(value)?.label ?? value}
        <ChevronDown className={cn("size-4 transition-transform", isOpen && "rotate-180")} />
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          className="absolute left-0 top-full mt-1 z-50 min-w-[220px] bg-popover text-popover-foreground border rounded-md shadow-lg overflow-hidden animate-in fade-in-0 zoom-in-95"
          onKeyDown={handleKeyDown}
        >
          {/* Search input */}
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search panels..."
                className="w-full pl-8 pr-2 py-1.5 text-sm bg-transparent border rounded focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* Results */}
          <div className="max-h-[300px] overflow-y-auto p-1">
            {filteredResults ? (
              // Search results
              filteredResults.length > 0 ? (
                filteredResults.map(({ option, category }) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={cn(
                      "w-full text-left px-2 py-1.5 text-sm rounded-sm flex items-center gap-2",
                      "hover:bg-accent hover:text-accent-foreground cursor-pointer",
                      option.value === value && "bg-accent/50"
                    )}
                  >
                    <span className="text-muted-foreground">{option.icon}</span>
                    <span className="flex-1">{option.label}</span>
                    <span className="text-xs text-muted-foreground">{category}</span>
                  </button>
                ))
              ) : (
                <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                  No panels found
                </div>
              )
            ) : (
              // Category tree
              PANEL_CATEGORIES.map((category) => (
                <div key={category.label}>
                  {/* Category header */}
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedCategory(expandedCategory === category.label ? null : category.label)
                    }
                    className="w-full text-left px-2 py-1.5 text-sm font-medium rounded-sm flex items-center gap-1.5 hover:bg-accent/50 cursor-pointer"
                  >
                    <ChevronRight
                      className={cn(
                        "size-4 transition-transform",
                        expandedCategory === category.label && "rotate-90"
                      )}
                    />
                    <span className="text-muted-foreground">{category.icon}</span>
                    {category.label}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {category.items.length}
                    </span>
                  </button>

                  {/* Category items */}
                  {expandedCategory === category.label && (
                    <div className="ml-4 border-l pl-1">
                      {category.items.map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => handleSelect(item.value)}
                          className={cn(
                            "w-full text-left px-2 py-1.5 text-sm rounded-sm flex items-center gap-2",
                            "hover:bg-accent hover:text-accent-foreground cursor-pointer",
                            item.value === value && "bg-accent/50"
                          )}
                        >
                          <span className="text-muted-foreground">{item.icon}</span>
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
