import type { TraceEvent } from "@stategraph/core";
import { CURRENT_SCHEMA_VERSION, type InspectTraceEvent, type TraceEnvelope } from "./schema";

// ---------------------------------------------------------------------------
// Generic channel abstraction — no dependency on browser APIs
// ---------------------------------------------------------------------------

/**
 * An abstract message channel. Implementations may wrap `window.postMessage`,
 * a browser-extension port, a WebSocket, a Node.js EventEmitter, etc.
 */
export interface InspectChannel {
  postMessage(message: unknown): void;
  addListener?(handler: (message: unknown) => void): () => void;
}

// ---------------------------------------------------------------------------
// Message shapes sent over the channel
// ---------------------------------------------------------------------------

export interface TraceEventMessage {
  kind: "trace:event";
  schemaVersion: string;
  sessionId: string;
  machineId: string;
  actorId: string;
  event: InspectTraceEvent;
}

export interface TraceSnapshotMessage {
  kind: "trace:snapshot";
  schemaVersion: string;
  sessionId: string;
  machineId: string;
  actorId: string;
  createdAt: number;
  events: InspectTraceEvent[];
}

export type BridgeMessage = TraceEventMessage | TraceSnapshotMessage;

// ---------------------------------------------------------------------------
// DevtoolsBridge — streams trace events over a channel
// ---------------------------------------------------------------------------

export interface DevtoolsBridgeOptions {
  channel: InspectChannel;
  machineId: string;
  sessionId?: string;
  actorId?: string;
  /**
   * When `true`, send a full `trace:snapshot` message when the bridge starts,
   * so late-connecting devtools can reconstruct the full history.
   * Default: `false`
   */
  sendSnapshot?: boolean;
  filter?: (event: InspectTraceEvent) => boolean;
}

export interface DevtoolsBridge {
  /** Detaches from the actor and stops forwarding events. Idempotent. */
  stop(): void;
  /** Returns the in-memory event log accumulated since the bridge started. */
  getLog(): TraceEnvelope;
}

/**
 * Attaches to an actor's inspect channel and forwards trace events to a
 * devtools channel. Provides an in-memory log so late-connecting clients
 * can request a replay snapshot.
 *
 * @example
 * ```ts
 * const bridge = createDevtoolsBridge(actor, {
 *   channel: { postMessage: (msg) => window.postMessage(msg, '*') },
 *   machineId: machine.id,
 * })
 * // later:
 * bridge.stop()
 * ```
 */
export function createDevtoolsBridge(
  actor: { inspect(listener: (event: TraceEvent) => void): () => void },
  options: DevtoolsBridgeOptions,
): DevtoolsBridge {
  const { channel, machineId, sendSnapshot = false, filter } = options;

  const sessionId = options.sessionId ?? generateId();
  const createdAt = Date.now();
  const log: InspectTraceEvent[] = [];
  let stopped = false;
  let resolvedActorId = options.actorId ?? "unknown";

  function handleEvent(raw: TraceEvent): void {
    if (stopped) return;
    if (!raw.type.startsWith("@")) return;

    const event = raw as unknown as InspectTraceEvent;
    if (resolvedActorId === "unknown" && raw.actorId) resolvedActorId = raw.actorId;
    log.push(event);

    if (filter && !filter(event)) return;

    const message: TraceEventMessage = {
      kind: "trace:event",
      schemaVersion: CURRENT_SCHEMA_VERSION,
      sessionId,
      machineId,
      actorId: resolvedActorId,
      event,
    };
    channel.postMessage(message);
  }

  const unsubscribe = actor.inspect(handleEvent);

  if (sendSnapshot) {
    const snapshot: TraceSnapshotMessage = {
      kind: "trace:snapshot",
      schemaVersion: CURRENT_SCHEMA_VERSION,
      sessionId,
      machineId,
      actorId: resolvedActorId,
      createdAt,
      events: [],
    };
    channel.postMessage(snapshot);
  }

  return {
    stop(): void {
      if (stopped) return;
      stopped = true;
      unsubscribe();
    },

    getLog(): TraceEnvelope {
      return {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        sessionId,
        machineId,
        actorId: resolvedActorId,
        createdAt,
        events: [...log],
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Message type guard — useful on the receiving end (devtools panel, etc.)
// ---------------------------------------------------------------------------

export function isBridgeMessage(value: unknown): value is BridgeMessage {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const kind = (value as Record<string, unknown>)["kind"];
  return kind === "trace:event" || kind === "trace:snapshot";
}

// ---------------------------------------------------------------------------
// Internal utility
// ---------------------------------------------------------------------------

function generateId(): string {
  const hex = () =>
    Math.floor(Math.random() * 0xffffffff)
      .toString(16)
      .padStart(8, "0");
  return `${hex()}-${hex().slice(0, 4)}-4${hex().slice(0, 3)}-${hex().slice(0, 4)}-${hex()}${hex().slice(0, 4)}`;
}
