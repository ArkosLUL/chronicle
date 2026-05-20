export const SERVER_NAME = import.meta.env.VITE_SERVER_NAME ?? "turtle";

/** Log type identifiers that match the backend LogType enum. */
export type DefaultLogType =
  | "v1"
  | "v2"
  | "azerothcore-clientside"
  | "epoch"
  | "kronos";

/** Features that may differ per server. */
export interface ServerCapabilities {
  armory: boolean;
  /** Which faction Blood Elf belongs to on this server. */
  bloodElfFaction: "Horde" | "Alliance";
  /** The log type used by default for this server (matches backend LogType). */
  defaultLogType: DefaultLogType;
}

const CAPABILITIES: Record<string, ServerCapabilities> = {
  turtle: { armory: true, bloodElfFaction: "Alliance", defaultLogType: "v2" },
  octowow: { armory: true, bloodElfFaction: "Alliance", defaultLogType: "v2" },
  azerothcore: {
    armory: true,
    bloodElfFaction: "Horde",
    defaultLogType: "azerothcore-clientside",
  },
};

const DEFAULT_CAPABILITIES: ServerCapabilities = {
  armory: true,
  bloodElfFaction: "Horde",
  defaultLogType: "v2",
};

/** Capabilities for the current server. */
export const serverCapabilities: ServerCapabilities =
  CAPABILITIES[SERVER_NAME] ?? DEFAULT_CAPABILITIES;
