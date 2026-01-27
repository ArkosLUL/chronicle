# EventsPanels Design

This directory contains the event aggregation panel system for displaying combat log metrics.

## Overview

EventsPanels process raw combat log event streams (damage, heal, resource_change) and aggregate them into displayable metrics. Each panel type defines its own aggregation logic and rendering, allowing for different result types and visualizations.

## Architecture

```
EventsPanels/
├── types.ts              # Core type definitions
├── usePanelAggregation.ts # Hook that processes events
├── EventsPanel.tsx       # Container component with panel selector
├── GenericPanel.tsx      # Shared loading/error wrapper + stats footer
├── EntityValueList.tsx   # Simple list renderer for Map<string, number>
├── DamageDone.tsx        # Panel definition: damage by caster
├── DamageTaken.tsx       # Panel definition: damage by target
├── HealingDone.tsx       # Panel definition: healing by caster
├── AllActivity.tsx       # Panel definition: event count by caster
└── index.ts              # Public exports
```

## Key Types

### EntitySelection & PanelContext

Context available to panels for filtering and rendering:

```typescript
interface EntitySelection {
  enemyIds: Set<string>;   // Selected enemy GUIDs
  playerIds: Set<string>;  // Selected player GUIDs
}

interface PanelContext {
  instance: Instance;              // Full instance data (players, encounters, metadata)
  selectedEncounters: Encounter[]; // Currently selected encounters
  selectedEncounterIds: string[];  // IDs of selected encounters
  entitySelection: EntitySelection; // Selected entities for filtering
}
```

### PanelDefinition<TResult>

The core interface that defines a panel type:

```typescript
interface PanelDefinition<TResult> {
  id: string;                    // Unique identifier
  label: string;                 // Display name
  icon: React.ReactNode;         // Icon component
  streams: StreamType[];         // Required streams: "damage" | "heal" | "resource_change"
  
  createState: () => TResult;    // Initialize aggregation state
  
  processEvent: (              // Called for each event
    state: TResult,
    event: ReusableDamage,
    encounterID: string,
    streamType: StreamType,
    context: PanelContext,       // Context for filtering
  ) => void;
  
  onContextChange?: (          // Optional: control reprocessing behavior
    prev: PanelContext,
    next: PanelContext,
  ) => 'reprocess' | 'rerender' | 'nothing';  // Default: 'reprocess'
  
  render: (props: PanelRenderProps<TResult>) => React.ReactNode;
}
```

### PanelRenderProps<TResult>

Props passed to the panel's render function:

```typescript
interface PanelRenderProps<TResult> {
  result: TResult;              // Aggregated state
  totalEvents: number;          // Events processed
  processingTimeMs: number | null;
  durationMs: number;           // Encounter duration
  perSecond: boolean;           // User toggle for /s display
  loading: boolean;
  processing: boolean;
  error: Error | null;
  context: PanelContext;        // Full context for rendering
}
```

## Data Flow

1. **EventsPanel** receives `selectedEncounters` and `panelType`
2. **usePanelAggregation** hook:
   - Fetches required streams from `InstanceEventsContext` (cached)
   - Creates fresh state via `panel.createState()`
   - Iterates events using `FastDamageCursor`
   - Calls `panel.processEvent()` for each event in selected encounters
   - Returns aggregated result
3. **panel.render()** displays the result

## Adding a New Panel

1. Create a new file (e.g., `OverhealingDone.tsx`):

```typescript
import { Heart } from "lucide-react";
import type { PanelDefinition, PanelRenderProps } from "./types";
import { GenericPanel } from "./GenericPanel";

// Define your result type
type OverhealMap = Map<string, { healing: number; overhealing: number }>;

export const OverhealingDonePanel: PanelDefinition<OverhealMap> = {
  id: "overhealing_done",
  label: "Overhealing",
  icon: <Heart className="h-4 w-4" />,
  streams: ["heal"],  // Which streams to fetch
  
  createState: () => new Map(),
  
  processEvent: (state, event, _encounterID, streamType, context) => {
    if (streamType !== "heal") return;
    
    // Filter by selected players if any are selected
    const { entitySelection } = context;
    if (entitySelection.playerIds.size > 0) {
      if (!entitySelection.playerIds.has(event.caster)) return;
    }
    
    const key = event.caster || "Unknown";
    const current = state.get(key) || { healing: 0, overhealing: 0 };
    // Your aggregation logic here
    current.healing += event.amount;
    state.set(key, current);
  },
  
  // Optional: optimize when only instance metadata changed (not entity selection)
  onContextChange: (prev, next) => {
    // Entity selection changed → must reprocess
    if (prev.entitySelection.playerIds.size !== next.entitySelection.playerIds.size) {
      return 'reprocess';
    }
    for (const id of prev.entitySelection.playerIds) {
      if (!next.entitySelection.playerIds.has(id)) return 'reprocess';
    }
    // Only instance metadata changed → just re-render (for name lookups, etc.)
    return 'rerender';
  },
  
  render: (props: PanelRenderProps<OverhealMap>) => (
    <GenericPanel {...props}>
      {/* Your custom visualization */}
      {/* Use props.context.instance.players for name lookups */}
    </GenericPanel>
  ),
};
```

2. Register in `EventsPanel.tsx`:

```typescript
import { OverhealingDonePanel } from "./OverhealingDone";

const PANELS: Record<string, PanelDefinition<any>> = {
  // ... existing panels
  overhealing_done: OverhealingDonePanel,
};

const PANEL_OPTIONS = [
  // ... existing options
  { value: "overhealing_done", label: "Overhealing" },
];
```

3. Export from `index.ts` if needed externally.

## Performance Considerations

### Re-render Triggers

The aggregation hook re-runs based on context changes:

1. **Always reprocesses when:**
   - `encounterIds` changes (user selects different encounters)
   - `panel` changes (user switches panel type)
   - `panel.streams` changes

2. **Asks panel via `onContextChange` when:**
   - Entity selection changes (playerIds, enemyIds)
   - Instance metadata changes

3. **Never re-runs for:**
   - Display-only changes like `perSecond` toggle (render-only)

### Context Change Actions

Panels can control reprocessing via `onContextChange(prev, next)`:
- `'reprocess'` (default): Re-run `processEvent` for all events
- `'rerender'`: Keep cached result, just re-render components
- `'nothing'`: Skip entirely (no state update)

### Event Processing

- Events are processed on the main thread (~50-80ms for 100k events)
- `FastDamageCursor` provides zero-allocation iteration
- The `event` object is reused - don't store references to it

### Stream Caching

Streams are cached at the `InstanceEventsContext` level. Multiple panels requesting the same stream type share the cached data.

## GenericPanel Component

Wrap your render content in `GenericPanel` to get:
- Loading state ("Fetching data...")
- Processing state ("Processing...")
- Error display
- Footer with event count and processing time

```typescript
render: (props) => (
  <GenericPanel {...props}>
    <YourVisualization data={props.result} />
  </GenericPanel>
)
```

## Event Object (ReusableDamage)

The event object passed to `processEvent`:

```typescript
interface ReusableDamage {
  index: number;        // Event index in stream
  offsetMilli: number;  // Time offset from encounter start
  caster: string;       // Caster GUID (may be empty)
  sourceName: string;   // Caster name
  target: string;       // Target GUID
  hitType: number;      // Hit type enum
  amount: number;       // Damage/healing amount
  school: number;       // Damage school
}
```

**Note:** The same object is reused for each event. Copy values if you need to store them.
