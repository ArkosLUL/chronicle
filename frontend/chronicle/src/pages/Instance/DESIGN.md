# Instance Page Design

## Overview
The Instance page displays detailed performance data for a **single encounter** within a dungeon/raid run, with navigation to switch between encounters.

## Data Model
- **Instance**: A single dungeon/raid run (e.g., "Molten Core - Jan 15, 2026")
- **Encounter**: A discrete combat segment within the instance
  - Boss encounters (prominent in sidebar)
  - Trash encounters (de-emphasized in sidebar)
  - Kill vs Wipe status

## Page Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  ← Back    Instance Name                              Duration   │
│            Realm • Date                                          │
├────────────────────┬─────────────────────────────────────────────┤
│  ENCOUNTER LIST    │                                             │
│                    │   Encounter Name               ✓ 2m 06s     │
│  ✓ Lucifron        │                                             │
│  ✓ Magmadar        │   ┌─────────────────────────────────────┐   │
│  ✓ Gehennas        │   │         DPS / Damage Done           │   │
│  ● Garr      ←     │   │      [PlayerMetricChart]            │   │
│  ✗ Garr (wipe)     │   └─────────────────────────────────────┘   │
│  ✓ Baron Geddon    │                                             │
│  ...               │   ┌─────────────────────────────────────┐   │
│                    │   │            Healing                  │   │
│  ▸ Trash (12)      │   │      [PlayerMetricChart]            │   │
│                    │   └─────────────────────────────────────┘   │
│                    │                                             │
│                    │   ┌─────────────────────────────────────┐   │
│                    │   │         Damage Taken                │   │
│                    │   │      [PlayerMetricChart]            │   │
│                    │   └─────────────────────────────────────┘   │
│                    │                                             │
└────────────────────┴─────────────────────────────────────────────┘
```

## Visual Hierarchy (Sidebar)
1. **Boss Kills** - ✓ checkmark, full opacity
2. **Boss Wipes** - ✗ skull, muted/smaller
3. **Trash** - Collapsed group, expandable

## Interaction
- **Multi-select**: Ctrl/Cmd+click to select multiple encounters
- **Merged metrics**: When multiple selected, values are summed across encounters
- **Collapsible sidebar**: Toggle button to hide/show encounter list

## Encounter Card Content
Each expanded encounter shows:
- **DPS/Damage** - PlayerMetricChart (type: damage)
- **Healing** - PlayerMetricChart (type: healing, with overheal stacked)
- **Damage Taken** - PlayerMetricChart (future: could be its own type)

## Component Breakdown
- `InstancePage` - Container with header + encounter list
- `EncounterCard` - Collapsible card for each encounter
- `TrashGroup` - Aggregated trash encounters
- `PlayerMetricChart` - Existing chart component

## Future Additions
- Timeline view of the instance
- Deaths breakdown
- Dispels/interrupts
- Buff uptime
