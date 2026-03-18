---
name: rotations-panel
description: >
  Rotations panel for Chronicle EventsPanels. Displays spell cast timelines as icons
  on a horizontal time axis. Default view shows one row per player; focus view (single
  entity selected) shows one row per spell ability. Uses spell_go/spell_start/spell_fail
  streams. Supports zoom, shift+scroll panning, and panel filters.
  Use when: modifying rotations panel UX, adding features to the cast timeline,
  changing how spell casts are visualized, or debugging rotation display issues.
advertise: true
---

# Rotations Panel

## File Layout

```
frontend/chronicle/src/pages/Instance/EventsPanels/Rotations/
├── rotations.processor.ts   # Worker-safe processor (pure TS, no React)
└── Rotations.tsx             # React panel component + createRotationsPanel()
```

## Registration Points

| File | Entry |
|------|-------|
| `processors/index.ts` | `rotationsProcessor` imported, exported, and added to `processorRegistry` |
| `EventsPanel.tsx` | `rotations: createRotationsPanel()` in `PANELS` |
| `useUrlState.ts` | `rotations: 'rot'` in `PANEL_CODES` |
| `PanelSelector.tsx` | `"rotations"` in the "Utility" category |

## Processor (`rotations.processor.ts`)

**Streams:** `["spell_go", "spell_start", "spell_fail"]`

- `spell_go` (SpellGoProcessorEvent) — completed casts (primary display)
- `spell_start` (SpellStartProcessorEvent) — cast started, includes `castTimeMilli` and `channelTimeMilli`
- `spell_fail` (SpellFailProcessorEvent) — failed casts

**Result type:**
```typescript
interface RotationsResult {
  castsByEntity: Map<string, CastEntry[]>;  // sourceGuid → time-ordered casts
  spellNames: Map<number, string>;           // spellId → name (also used to derive allSpellIds)
  GuidCache: GuidCache;
}

interface CastEntry {
  offsetMilli: number;
  spellId: number;
  spellName: string;
  target: string;
  eventType: "spell_go" | "spell_start" | "spell_fail";
  castTimeMilli?: number;      // spell_start only
  channelTimeMilli?: number;   // spell_start only
}
```

**Filtering:** Respects `context.entitySelection` (playerIds/enemyIds) and `context.selectedEncounterIds`.

**Serialization note:** `Set` does not survive worker `postMessage`. Spell IDs are derived from `spellNames.keys()` in the React component, not stored as a Set in the result.

## Panel Component (`Rotations.tsx`)

### Key Constants
```
ICON_SIZE = 22        ROW_HEIGHT = 28       LABEL_WIDTH = 120
TIME_HEADER_HEIGHT = 24   DEFAULT_PPS = 50 (pixels per second)
ZOOM_STEPS = [8, 15, 25, 50, 100, 200, 400]
```

### Two View Modes

1. **Default view** — one row per entity (player/mob), all casts as icons on shared timeline. Rows sorted by cast count descending. Entity names resolved from `context.instance.players[guid]` or `context.instance.units[guid]` (these are `Record<string, ...>`, NOT arrays).

2. **Focus view** — activated when `entitySelection.playerIds.size === 1 || enemyIds.size === 1`. Groups casts by `spellId`, one row per ability. Rows sorted by cast count descending. Label column shows small spell icon via `FocusRowIcon` component.

### Single Encounter Requirement
Panel shows "Select a single encounter to view rotations" when `context.selectedEncounterIds.length !== 1`.

### Spell Icons
Each `CastIcon` uses `useSpell(spellId)` + `SpellIconWithTooltip` for icon display with hover tooltip. Falls back to a letter placeholder while loading. `useSpell` has `staleTime: Infinity` so each spell is fetched once.

### Layout Structure
```
┌─ flex-col h-full overflow-hidden ──────────────────────┐
│ [zoom controls bar]  flex-shrink-0                      │
│ ┌─ flex-1 min-h-0 overflow-y-auto ───────────────────┐ │
│ │ ┌─ flex ──────────────────────────────────────────┐ │ │
│ │ │ [label col]          │ [scrollable timeline]    │ │ │
│ │ │ sticky left-0 z-10   │ overflow-x-auto          │ │ │
│ │ │ width: LABEL_WIDTH   │ onWheel={shift+scroll}   │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Zoom Controls
`[-]` and `[+]` buttons step through `ZOOM_STEPS`. Label shows ratio relative to `DEFAULT_PPS` (e.g., "1x", "2x", "0.3x").

### Horizontal Panning
`onWheel` handler on the scrollable timeline div: if `e.shiftKey`, prevents default and adds `e.deltaY` to `scrollLeft`.

### Time Axis
Tick interval auto-calculated from `pixelsPerSecond` targeting ~100px between ticks, snapping to nice intervals (1s, 2s, 5s, 10s, 15s, 30s, 60s, etc.). Ticks rendered as absolutely positioned divs with gridlines extending through rows.

### Default Filters
```typescript
defaultFilters: [
  { type: "source_type", value: ["player"] }
]
```
Filters to player casts only by default. User can modify via filter editor.

### Panel Definition
```typescript
{
  ...rotationsProcessor,
  label: "Rotations",
  icon: <RotateCcw />,
  supportsPerSecond: false,
  supportsFiltering: true,
  defaultFilters: [{ type: "source_type", value: ["player"] }],
}
```

## Common Gotchas

- **`context.instance.players` is a Record, not an array** — use `players[guid]`, not `.find()`.
- **Sets don't serialize through postMessage** — use Maps or arrays in processor result types.
- **Panel height** — the root div must use `h-full min-h-0 overflow-hidden` with `flex-1 min-h-0 overflow-y-auto` on the scrollable area to stay within the PanelCard bounds.
- **`useSpell` per icon** — works because React Query deduplicates and caches. Each unique spellId is fetched once.
