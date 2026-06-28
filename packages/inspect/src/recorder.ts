import type { TraceEvent } from "@stategraph/core";
import { CURRENT_SCHEMA_VERSION, type InspectTraceEvent, type TraceEnvelope } from "./schema";

export interface TraceRecorderOptions {
  machineId?: string;
  sessionId?: string;
  actorId?: string;
}

export interface TraceRecorder {
  /** Returns the envelope accumulated so far (a snapshot, not a live reference). */
  getEnvelope(): TraceEnvelope;
  /** Stops recording and unsubscribes from the actor. Idempotent. */
  stop(): void;
  /** Clears accumulated events without stopping. */
  reset(): void;
}

/**
 * Attaches to an actor's inspect channel and records trace events into a
 * `TraceEnvelope`. The recorder does not alter the actor's behavior.
 *
 * @example
 * ```ts
 * const actor = createActor(machine).start()
 * const recorder = createTraceRecorder(actor, { machineId: machine.id })
 * actor.send({ type: 'SUBMIT' })
 * const envelope = recorder.getEnvelope()
 * recorder.stop()
 * ```
 */
export function createTraceRecorder(
  actor: { inspect(listener: (event: TraceEvent) => void): () => void },
  options: TraceRecorderOptions = {},
): TraceRecorder {
  const events: InspectTraceEvent[] = [];
  const createdAt = Date.now();
  const sessionId = options.sessionId ?? generateId();
  const machineId = options.machineId ?? "unknown";
  let actorId = options.actorId ?? "unknown";
  let stopped = false;

  function handleEvent(raw: TraceEvent): void {
    if (stopped) return;
    // Capture actorId from first event if not provided
    if (actorId === "unknown" && raw.actorId) actorId = raw.actorId;
    // Narrow: only store events with known types
    if (!raw.type.startsWith("@")) return;
    events.push(raw as unknown as InspectTraceEvent);
  }

  const unsubscribe = actor.inspect(handleEvent);

  return {
    getEnvelope(): TraceEnvelope {
      return {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        sessionId,
        machineId,
        actorId,
        createdAt,
        events: [...events],
      };
    },

    stop(): void {
      if (stopped) return;
      stopped = true;
      unsubscribe();
    },

    reset(): void {
      events.splice(0);
    },
  };
}

function generateId(): string {
  // Minimal UUID-like ID without crypto dependency (fine for session IDs in tooling)
  const hex = () => Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
  return `${hex()}-${hex().slice(0, 4)}-4${hex().slice(0, 3)}-${hex().slice(0, 4)}-${hex()}${hex().slice(0, 4)}`;
}
