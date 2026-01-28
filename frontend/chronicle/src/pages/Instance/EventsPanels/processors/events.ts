import type { 
  DamageProcessorEvent,
  ExtraAttackProcessorEvent,
  HealProcessorEvent, 
  ProcessorEvent, 
  ResourceChangeProcessorEvent,
  SlainProcessorEvent
} from "../processorTypes";

export function isResourceChangeEvent(
  event: ProcessorEvent,
  streamType: string
): event is ResourceChangeProcessorEvent {
  return streamType === "resource_change" && event.type === "resource_change";
}

export function isHealingEvent(
  event: ProcessorEvent,
  streamType: string
): event is HealProcessorEvent {
  return streamType === "heal" && event.type === "heal";
}

export function isDamageEvent(
  event: ProcessorEvent,
  streamType: string
): event is DamageProcessorEvent {
  return streamType === "damage" && event.type === "damage";
}

export function isExtraAttackEvent(
  event: ProcessorEvent,
  streamType: string
): event is ExtraAttackProcessorEvent {
  return streamType === "extra_attack" && event.type === "extra_attack";
}

export function isSlainEvent(
  event: ProcessorEvent,
  streamType: string
): event is SlainProcessorEvent {
  return streamType === "slain" && event.type === "slain";
}