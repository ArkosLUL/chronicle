# Sync Mode Design Document

## Overview

Sync Mode is a feature that synchronizes EventsPanel data display with video playback or manual timestamp control. Instead of showing aggregated data for entire encounters, it shows data **up to a specific point in time**, allowing users to see how damage/healing/etc. accumulated as the fight progressed.

### Use Cases

1. **Video Analysis**: Sync panel data with YouTube recordings to see exactly what was happening at each moment
2. **Timeline Scrubbing**: Manually step through an encounter to analyze specific phases
3. **Teaching Tool**: Walk through encounters showing how metrics build up over time

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         InstancePage                                 │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    SyncModeProvider                          │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │   │
│  │  │ enabled      │  │ currentTime  │  │ encounterBounds  │   │   │
│  │  │ isPlaying    │  │ playbackSpeed│  │ metrics          │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│              ┌───────────────┼───────────────┐                      │
│              ▼               ▼               ▼                      │
│  ┌──────────────────┐ ┌─────────────┐ ┌──────────────────┐         │
│  │ SyncControlOverlay│ │YouTubeOverlay│ │  EventsPanels    │         │
│  │ (manual controls) │ │(video sync)  │ │                  │         │
│  └──────────────────┘ └─────────────┘ └──────────────────┘         │
└─────────────────────────────────────────────────────────────────────┘
```

## Processing Modes

EventsPanels support two processing modes, selected automatically based on sync state:

### 1. Worker Mode (Default)

- Uses Web Worker for background processing
- Processes **all events** in selected encounters
- Result is cached until context changes
- Best for: Static views, initial page load

### 2. Sync Mode (When enabled)

- Uses **main thread** incremental processing
- Processes events **up to currentTimestamp**
- Supports pause/resume without reprocessing
- Best for: Video sync, timeline scrubbing

```
┌─────────────────────────────────────────────────────────────────┐
│                    usePanelAggregation                          │
│                                                                  │
│  syncMode.enabled?                                              │
│       │                                                          │
│       ├── false ──► Worker Mode ──► Web Worker ──► Full result  │
│       │                                                          │
│       └── true ───► Sync Mode ───► Main Thread ──► Partial      │
│                         │            Processor      result      │
│                         │                                        │
│                         ▼                                        │
│              processIncrementally()                             │
│              - Resume from previous state                        │
│              - Stop at currentTimestamp                          │
│              - Return state for next resume                      │
└─────────────────────────────────────────────────────────────────┘
```

## Incremental Processing

The key innovation is **incremental processing with precise resume**. This allows advancing through time without reprocessing all events from the start.

### State Tracking

```typescript
interface IncrementalProcessorState<TResult> {
  result: TResult;              // Accumulated processor state
  processedCount: number;       // Total events processed
  lastTimestamp: Date | null;   // Where we stopped
  eventsAtLastTimestamp: number; // Events processed at that exact ms
  isDone: boolean;              // Reached end of all events?
}
```

### Resume Algorithm

When resuming from timestamp T1 to T2:

```
Timeline: [0]═══════[T1]═══════[T2]═══════[end]
          └─ already ─┘└─ need to ─┘
            processed    process

1. Skip events where timestamp < T1 (already in state)
2. Skip exactly N events at timestamp = T1 (where N = eventsAtLastTimestamp)
3. Process events where T1 < timestamp ≤ T2
4. Stop and save state for next resume
```

### Handling Same-Millisecond Events

Multiple events can occur at the same millisecond. To avoid duplicates or misses:

```
t=1000ms:  [E1] [E2] [E3] [E4] [E5]
                      ↑
              Stopped after E3
              lastTimestamp = 1000
              eventsAtLastTimestamp = 3

On resume to t=1100ms:
- t < 1000: skip all
- t = 1000: skip first 3, process E4, E5
- t > 1000: process until t > 1100
```

## Performance Optimizations

### 1. Encounter-Level Skipping

Binary format stores events grouped by encounter with a `dataLength` field:

```
[Header: encounterID, timestamp, count, dataLength][Message Data]
```

When resuming, we can skip entire encounters by jumping `dataLength` bytes:

```typescript
skipEncounter(): boolean {
  if (this._messagesReadInEncounter > 0) {
    return this.nextEncounter(); // Fall back if partially read
  }
  // Jump directly - no decoding!
  this.offset += this._currentHeader.dataLength;
  return this._loadNextEncounterHeader();
}
```

**Heuristic**: Skip encounters whose start time is 60+ seconds before the resume timestamp. This is conservative to avoid skipping encounters that might contain events we need.

### 2. Timestamp-Based Throttling

The sync timestamp can change rapidly (every frame during video playback). We throttle processing to 100ms intervals:

```typescript
// Throttle pattern: process immediately, then buffer for 100ms
if (!throttleTimeoutRef.current) {
  setThrottledSyncTimestamp(syncTimestamp); // Process now
  throttleTimeoutRef.current = setTimeout(() => {
    // Process any pending timestamp after throttle window
  }, 100);
} else {
  pendingTimestampRef.current = syncTimestamp; // Buffer for later
}
```

### 3. Shallow Cloning for React

The processor mutates state in place for performance. To trigger React re-renders, we shallow clone before returning:

```typescript
function shallowClone<T>(obj: T): T {
  return { ...obj } as T;
}

return {
  result: shallowClone(state), // New reference, same Maps inside
  // ...
};
```

## Data Flow

### Video Sync Flow

```
YouTubeOverlay                SyncModeContext              usePanelAggregation
     │                              │                              │
     │ video.getCurrentTime()       │                              │
     │─────────────────────────────►│                              │
     │                              │                              │
     │ videoTimeToCombatLogTime()   │                              │
     │         ┌────────────────────┤                              │
     │         │ Interpolate using  │                              │
     │         │ sync points        │                              │
     │         └────────────────────┤                              │
     │                              │                              │
     │ setTimestamp(combatLogTime)  │                              │
     │─────────────────────────────►│ currentTimestamp updated     │
     │                              │─────────────────────────────►│
     │                              │                              │
     │                              │        throttledSyncTimestamp│
     │                              │◄─────────────────────────────│
     │                              │                              │
     │                              │     processIncrementally()   │
     │                              │─────────────────────────────►│
     │                              │                              │
     │                              │            result            │
     │                              │◄─────────────────────────────│
     │                              │                              │
     │                              │         Panel re-renders     │
```

### Manual Control Flow

```
SyncControlOverlay          SyncModeContext              usePanelAggregation
     │                              │                              │
     │ User clicks +1s              │                              │
     │─────────────────────────────►│                              │
     │                              │                              │
     │ step(1000)                   │                              │
     │         ┌────────────────────┤                              │
     │         │ currentTimestamp   │                              │
     │         │ += 1000ms          │                              │
     │         └────────────────────┤                              │
     │                              │ (same flow as above)         │
     │                              │─────────────────────────────►│
```

## Component Reference

### SyncModeContext (`SyncModeContext.tsx`)

Provides global sync state and controls:

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether sync mode is active |
| `currentTimestamp` | `Date \| null` | Current position in combat log time |
| `isPlaying` | `boolean` | Auto-advancing playback |
| `playbackSpeed` | `number` | Speed multiplier (0.25x - 4x) |
| `encounterBounds` | `{start, end}` | Time range for UI slider |

| Method | Description |
|--------|-------------|
| `enable()` / `disable()` | Toggle sync mode |
| `setTimestamp(date)` | Jump to specific time |
| `play()` / `pause()` | Control auto-playback |
| `step(deltaMs)` | Move forward/backward |

### SyncControlOverlay (`SyncControlOverlay.tsx`)

Floating control panel with:
- Enable/disable toggle
- Current timestamp display
- Progress slider
- Play/pause, step ±100ms, step ±1s
- Speed selector (0.25x - 4x)
- Debug metrics panel

### mainThreadProcessor (`mainThreadProcessor.ts`)

Core incremental processing logic:

```typescript
processIncrementally<TResult>(options: {
  panelId: string;
  streams: Map<StreamType, CachedStream>;
  context: SerializableProcessorContext;
  stopAtTimestamp: Date | null;
  previousState: IncrementalProcessorState<TResult> | null;
}): Promise<ProcessIncrementallyResult<TResult>>
```

### usePanelAggregation (`usePanelAggregation.ts`)

Hook that orchestrates processing:
- Detects sync mode from context
- Routes to worker or main-thread processor
- Manages incremental state between renders
- Throttles timestamp updates

### useCachedValue (`useCachedValue.ts`)

Caching hook with sync mode awareness:
- In normal mode: caches first valid result
- In sync mode: bypasses caching, returns live values
- On mode transition: marks old values as stale

## Limitations

1. **No true cursor resume**: We track timestamp + event count, not byte offsets. Resume still iterates (but doesn't decode) events before the resume point within the current encounter.

2. **60-second heuristic**: Encounter skipping uses a conservative heuristic. Very long encounters (>60s) won't benefit from encounter-level skipping until you're 60s past their start.

3. **Memory usage**: Previous state is kept in memory for resume. For very large results, this could be significant.

4. **Single-encounter optimization**: The encounter-skip optimization helps most when there are multiple encounters. Within a single long encounter, we still iterate through events.

## Future Improvements

1. **Byte-offset tracking**: Store cursor byte positions to skip directly without iteration

2. **Binary search within encounters**: Use event indices or offsets for faster seeking

3. **Streaming updates**: Send partial results during processing for smoother UI

4. **Backward playback**: Currently seeking backward requires full reprocessing. Could cache checkpoints.

5. **Worker-based sync mode**: Move incremental processing to worker to avoid main thread blocking

## Experimental Status

This feature is currently behind the `?exp=1` query parameter flag. To enable:

```
https://chronicle.example.com/instance/123?exp=1
```

The flag gates the "Sync" button in the instance page header.
