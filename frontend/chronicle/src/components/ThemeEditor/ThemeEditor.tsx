import { useState, useRef } from "react";
import { ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Each knob maps to a branding.theme key that the backend's buildThemeCSS
 * expands into one or more CSS custom properties.
 * Keep keys in sync with the Go themeKnobs map in api/api.go.
 */
const KNOBS = [
  { key: "primary", label: "Primary", defaultHex: "#5F8FA6", description: "Buttons, active states, accents" },
  { key: "accent", label: "Accent", defaultHex: "#89744D", description: "Secondary buttons, badges" },
  { key: "background", label: "Background", defaultHex: "#2B2B2B", description: "Page background" },
  { key: "card", label: "Card", defaultHex: "#262626", description: "Card/panel surfaces" },
  { key: "border", label: "Border", defaultHex: "#383838", description: "Borders, dividers, inputs" },
  { key: "foreground", label: "Foreground", defaultHex: "#E6E8EA", description: "Main text color" },
  { key: "muted_text", label: "Muted text", defaultHex: "#B4B0AC", description: "Secondary/helper text" },
  { key: "link", label: "Link", defaultHex: "#26A9F1", description: "Link text" },
  { key: "destructive", label: "Destructive", defaultHex: "#EF4444", description: "Error/delete states" },
] as const;

type ThemeMap = Record<string, string>;

interface ThemeEditorProps {
  value: ThemeMap;
  onChange: (theme: ThemeMap) => void;
}

export function ThemeEditor({ value, onChange }: ThemeEditorProps) {
  const [open, setOpen] = useState(false);

  const hasAnyOverride = KNOBS.some((k) => value[k.key]);

  const setKnob = (key: string, hex: string) => {
    onChange({ ...value, [key]: hex });
  };

  const resetKnob = (key: string) => {
    const next = { ...value };
    delete next[key];
    onChange(next);
  };

  const resetAll = () => {
    onChange({});
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="flex w-full items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        Theme Colors
        {hasAnyOverride && <span className="ml-1 text-xs text-primary">(customized)</span>}
      </button>

      {open && (
        <div className="space-y-2 pl-1">
          <div className="grid gap-2">
            {KNOBS.map((knob) => {
              const current = value[knob.key];
              const isOverridden = !!current;
              const displayHex = current || knob.defaultHex;
              return (
                <div key={knob.key} className="flex items-center gap-3">
                  <input
                    type="color"
                    value={displayHex}
                    onChange={(e) => setKnob(knob.key, e.target.value)}
                    className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent p-0 shrink-0"
                  />
                  <HexInput
                    value={displayHex}
                    onChange={(hex) => setKnob(knob.key, hex)}
                    placeholder={knob.defaultHex}
                  />
                  <div className="flex flex-col min-w-0">
                    <span className={`text-sm leading-tight ${isOverridden ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                      {knob.label}
                    </span>
                    <span className="text-xs text-muted-foreground/70 leading-tight">{knob.description}</span>
                  </div>
                  {isOverridden && (
                    <button
                      type="button"
                      onClick={() => resetKnob(knob.key)}
                      className="ml-auto shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                      title="Reset to default"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {hasAnyOverride && (
            <Button type="button" variant="ghost" size="sm" onClick={resetAll} className="text-xs">
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset All
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** Small text input that lets you type/paste hex colors freely, committing on valid input. */
function HexInput({ value, onChange, placeholder }: { value: string; onChange: (hex: string) => void; placeholder: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  const display = draft ?? value;

  const commit = (raw: string) => {
    let v = raw.trim();
    if (!v.startsWith("#")) v = "#" + v;
    v = v.toLowerCase();
    if (HEX_RE.test(v)) {
      onChange(v);
      setDraft(null);
    }
  };

  return (
    <input
      ref={ref}
      type="text"
      value={display}
      onChange={(e) => {
        setDraft(e.target.value);
        // Auto-commit if pasted/typed a full valid hex
        let v = e.target.value.trim();
        if (!v.startsWith("#")) v = "#" + v;
        if (HEX_RE.test(v)) {
          onChange(v.toLowerCase());
          setDraft(null);
        }
      }}
      onBlur={() => {
        if (draft !== null) commit(draft);
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && draft !== null) {
          commit(draft);
          ref.current?.blur();
        }
      }}
      placeholder={placeholder}
      className="w-20 rounded border bg-background px-1.5 py-0.5 text-xs font-mono shrink-0"
    />
  );
}
