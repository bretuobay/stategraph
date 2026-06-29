import type { ActorRef, StateGraphEvent } from "@stategraph/core";

export type DevtoolsRegistrationHandler = (
  actor: ActorRef<unknown, StateGraphEvent>,
  machineId: string,
) => void;

// Stored on globalThis so the handler is shared even if this module is
// bundled into two separate chunks (index entry + devtools entry).
const _g = globalThis as typeof globalThis & Record<string, unknown>;
const _key = "__stategraph_devtools_handler";

export function activateDevtools(handler: DevtoolsRegistrationHandler): () => void {
  _g[_key] = handler;
  return () => {
    _g[_key] = undefined;
  };
}

export function registerWithDevtools(
  actor: ActorRef<unknown, StateGraphEvent>,
  machineId: string,
): void {
  const h = _g[_key];
  if (typeof h === "function") {
    (h as DevtoolsRegistrationHandler)(actor, machineId);
  }
}
