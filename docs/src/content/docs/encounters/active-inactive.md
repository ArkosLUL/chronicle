---
title: Active vs Inactive Periods
description: The core abstraction Chronicle uses to track combat state and determine encounter boundaries
---

Chronicle automatically detects combat encounters from raw combat logs. This page explains the **period** abstraction — the foundation of encounter detection.

## The Problem

A raw combat log is a continuous stream of events — damage, healing, buffs, deaths — with no clear markers for "boss fight started" or "boss fight ended." Chronicle must infer encounter boundaries from the combat data itself.

## Active vs Inactive Periods

Chronicle tracks every entity as having **activity periods**. A period represents a span of time when that entity has observed activity (usually combat, but not always a 1:1 mapping).

### Period States

| State | Description |
|-------|-------------|
| **Active** | The entity has recent activity. Events are being recorded. |
| **Inactive** | Not active and events are not being recorded |

A period transitions from Active → Inactive when:
- The entity **dies** (slain)
- The entity **resets** (left combat without dying, e.g., CC like Hibernate expired)
- The period **times out** (no activity for a configured duration)

### Example: Boss Fight

```
Timeline:
├─ 00:00  Boss takes damage       → Period BEGINS (Active)
├─ 00:15  Raid dealing damage     → Period BUMPED (stays Active)
├─ 00:45  Boss CC'd (no damage)   → Period enters GRACE PERIOD
├─ 00:48  No activity...
├─ 00:49  Damage resumes          → Grace period CANCELLED, stays Active
├─ 02:30  Boss dies               → Period ENDS (slain)
```

## How Periods Work

### Starting a Period

A period begins when Chronicle observes qualifying combat activity involving the tracked entity:
- The entity deals or receives **direct damage**
- The entity is affected by **crowd control** (CC)
- Healing an active target

Some bosses have custom detection logic for special mechanics, but damage is the primary trigger.

### Keeping a Period Active (Bumping)

Once active, certain events "bump" the period — extending the inactivity timeout without restarting the period. This handles gaps in combat (phase transitions, movement, etc.).

**Events that bump:**
- Any damage dealt or received
- Healing an active target

### Ending a Period

Periods end in one of three ways:

1. **Slain** — The entity died. This is the "clean" end of an encounter (kill).

2. **Reset** — The entity left combat without dying. This can only occur after experiencing some form of crowd control like polymorph or sap.

3. **Timeout** — No qualifying activity occurred within the timeout window. This typically means a wipe, as the enemy remains alive.

### End States in Data

```json
{
  "start": { "timestamp": "2024-01-15T20:00:00Z", "reason": "damage_dealt" },
  "end": { "timestamp": "2024-01-15T20:03:20Z", "reason": "slain" },
  "end_state": "slain"
}
```

The `end_state` field tells you how the encounter ended:
- `slain` — Boss killed
- `reset` — Mob reset
- `timeout` — Usually a wipe

## Multiple Periods

A single boss can have multiple periods in one log — for example, multiple attempts on a boss before a kill:

```
Attempt 1: Active → Timeout (wipe at 2 min)
Attempt 2: Active → Timeout (wipe at 3 min)  
Attempt 3: Active → Slain (kill at 4 min)
```

Chronicle records all attempts, allowing you to compare performance across wipes.

## Reset Grace Periods

When crowd control (CC) fades from an entity, it may leave combat. To avoid incorrectly ending periods the instant CC drops, Chronicle uses a **reset grace period**.

When CC fades, instead of immediately ending the period:

1. Period enters a **pending reset** state
2. A 5-second grace window starts
3. If activity resumes → grace period cancelled, period stays active
4. If no activity → period ends with `reset` state

This handles cases where CC is reapplied or damage resumes before the mob fully resets.
