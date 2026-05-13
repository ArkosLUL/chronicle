const SERVER_NAME = import.meta.env.VITE_SERVER_NAME ?? "turtle";

/** Features that may differ per server. */
export interface ServerCapabilities {
  armory: boolean;
}

const CAPABILITIES: Record<string, ServerCapabilities> = {
  turtle: { armory: true },
};

const DEFAULT_CAPABILITIES: ServerCapabilities = {
  armory: true,
};

/** Capabilities for the current server. */
export const serverCapabilities: ServerCapabilities =
  CAPABILITIES[SERVER_NAME] ?? DEFAULT_CAPABILITIES;
