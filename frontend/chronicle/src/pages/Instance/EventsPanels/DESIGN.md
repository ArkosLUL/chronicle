# EventsPanels Design

This directory contains the event aggregation panel system for displaying combat log metrics.

## Overview

EventsPanels process raw combat log event streams (damage, heal, resource_change) and aggregate them into displayable metrics. Each panel type defines its own aggregation logic and rendering, allowing for different result types and visualizations.

**Key feature:** Event processing runs in a Web Worker to keep the UI responsive.

## Architecture

```
EventsPanels/
├── types.ts              # React-side type definitions (PanelContext, PanelDefinition)
├── processorTypes.ts     # Worker-safe types (ProcessorContext, PanelProcessor)
├── panelWorker.ts        # Web Worker that runs processEvent
├── usePanelAggregation.ts # Hook that manages worker lifecycle
├── EventsPanel.tsx       # Container component with panel selector
├── GenericPanel.tsx      # Shared loading/error wrapper + stats footer
├── EntityValueList.tsx   # Simple list renderer for Map<string, number>
├── processors/           # Pure TypeScript processors (worker-safe)
│   ├── index.ts          # Registry of all processors
│   ├── damageDone.processor.ts
│   ├── damageTaken.processor.ts
│   ├── healingDone.processor.ts
│   └── allActivity.processor.ts
├── DamageDone.tsx        # Panel definition: React wrapper + render
├── DamageTaken.tsx       # Panel definition: React wrapper + render
├── HealingDone.tsx       # Panel definition: React wrapper + render
├── AllActivity.tsx       # Panel definition: React wrapper + render
└── index.ts              # Public exports
```

## Worker Architecture

```
Main Thread                          Web Worker
─────────────                        ──────────
                                     
usePanelAggregation                  panelWorker.ts
  │                                    │
  ├─ Fetch streams (cached)            │
  ├─ Create Worker ─────────────────►  │
  ├─ postMessage(WorkerRequest) ────►  ├─ processorRegistry[panelId]
  │                                    ├─ Iterate all events
  │                                    ├─ Call processor.processEvent()
  │  ◄─── postMessage(WorkerResponse)  ├─ Serialize result (Map → Array)
  ├─ Deserialize result                │
  ├─ setResult(state)                  │
  └─ Terminate worker on cleanup       │
```

**Cancellation:** When context changes mid-processing, the current worker is terminated
and a new one is started. Stale responses are ignored via `requestId` matching.

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

1. **EventsPanel** receives `context` (PanelContext) and `panelType`
2. **usePanelAggregation** hook:
   - Fetches required streams from `InstanceEventsContext` (cached)
   - Creates a Web Worker
   - Sends streams + serialized context to worker
   - Worker iterates all events, calls `processor.processEvent()`
   - Worker returns serialized result
   - Hook deserializes result (Map reconstruction)
3. **panel.render()** displays the result on main thread

## Adding a New Panel

Panels are split into two files: a **processor** (worker-safe) and a **React wrapper**.

### Step 1: Create the processor (`processors/overhealingDone.processor.ts`)

```typescript
// Pure TypeScript - NO React, NO JSX
import type { PanelProcessor, ProcessorContext, ProcessorEvent } from "../processorTypes";

export type OverhealState = Map<string, { healing: number; overhealing: number }>;

export const overhealingDoneProcessor: PanelProcessor<OverhealState> = {
  id: "overhealing_done",
  streams: ["heal"],
  
  createState: () => new Map(),
  
  processEvent: (state, event, _encounterID, streamType, context) => {
    if (streamType !== "heal") return;
    
    // Filter by selected players if any are selected
    const { entitySelection } = context;
    if (entitySelection.playerIds.length > 0) {
      if (!entitySelection.playerIds.includes(event.caster)) return;
    }
    
    const key = event.caster || "Unknown";
    const current = state.get(key) || { healing: 0, overhealing: 0 };
    current.healing += event.amount;
    state.set(key, current);
  },
};
```

### Step 2: Register the processor (`processors/index.ts`)

```typescript
import { overhealingDoneProcessor } from "./overhealingDone.processor";

export { overhealingDoneProcessor } from "./overhealingDone.processor";
export type { OverhealState } from "./overhealingDone.processor";

export const processorRegistry: Record<string, PanelProcessor<any>> = {
  // ... existing processors
  overhealing_done: overhealingDoneProcessor,
};
```

### Step 3: Create the React wrapper (`OverhealingDone.tsx`)

```typescript
import { Heart } from "lucide-react";
import type { PanelDefinition, PanelRenderProps } from "./types";
import { GenericPanel } from "./GenericPanel";
import { overhealingDoneProcessor, type OverhealState } from "./processors";

export const OverhealingDonePanel: PanelDefinition<OverhealState> = {
  ...overhealingDoneProcessor,  // Spread id, streams, createState, processEvent
  label: "Overhealing",
  icon: <Heart className="h-4 w-4" />,
  
  render: (props: PanelRenderProps<OverhealState>) => (
    <GenericPanel {...props}>
      {/* Your custom visualization */}
      {/* Use props.context.instance.players for name lookups */}
    </GenericPanel>
  ),
};
```

### Step 4: Register in `EventsPanel.tsx`

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
