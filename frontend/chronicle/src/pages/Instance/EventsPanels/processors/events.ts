import type { 
  ExtraAttackProcessorEvent,
  HealProcessorEvent, 
  ProcessorEvent, 
  ResourceChangeProcessorEvent 
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
): event is HealProcessorEvent {
  return streamType === "damage" && event.type === "damage";
}

export function isExtraAttackEvent(
  event: ProcessorEvent,
  streamType: string
): event is ExtraAttackProcessorEvent {
  return streamType === "extra_attack" && event.type === "extra_attack";
}