import {
  createActor,
  fromPromise,
  type EffectDefinition,
  type StateGraphEvent,
  type StateGraphMachine,
  type StateGraphSnapshot,
} from "@stategraph/core";
import type { TraceEnvelope } from "./schema";

export interface ReplayOptions {
  /**
   * Override specific effect implementations for the replay run.
   * Effects not listed here are reconstructed from the trace's captured outputs,
   * resolving or rejecting in the same order they originally settled.
   */
  effects?: Record<string, EffectDefinition>;
}

export interface ReplayResult<TContext = unknown> {
  /** Ordered snapshots produced during the replay run. */
  snapshots: ReadonlyArray<StateGraphSnapshot<TContext>>;
  /**
   * Events replayed into the actor (derived from `@event.received` in the trace,
   * excluding internal `@@INIT` and `@`-prefixed runtime events).
   */
  replayedEvents: ReadonlyArray<StateGraphEvent>;
}

/**
 * Replays a recorded `TraceEnvelope` against a fresh actor instance.
 *
 * Effect results captured in the trace (`@effect.done`, `@effect.error`) drive
 * auto-resolving `fromPromise` mocks so the replay is deterministic without
 * re-executing real side effects. Caller-provided `options.effects` take
 * precedence over captured results for any named effect.
 *
 * @example
 * ```ts
 * const recorder = createTraceRecorder(actor, { machineId: machine.id })
 * actor.send({ type: 'SUBMIT' })
 * const result = replayTrace(machine, recorder.getEnvelope())
 * console.log(result.replayedEvents.length) // 1
 * ```
 */
export function replayTrace<TContext = unknown, TEvent extends StateGraphEvent = StateGraphEvent>(
  machine: StateGraphMachine<TContext, TEvent>,
  envelope: TraceEnvelope,
  options: ReplayOptions = {},
): ReplayResult<TContext> {
  const { events } = envelope;

  // 1. Extract user-dispatched events from @event.received traces (seq-ordered)
  const replayedEvents: StateGraphEvent[] = [];
  for (const e of events) {
    if (e.type !== "@event.received") continue;
    const ev = (e as { type: "@event.received"; event: unknown }).event;
    if (
      ev !== null &&
      typeof ev === "object" &&
      typeof (ev as Record<string, unknown>)["type"] === "string"
    ) {
      const evTyped = ev as StateGraphEvent;
      // Skip internal events that should not be re-sent
      if (!evTyped.type.startsWith("@") && evTyped.type !== "@@INIT") {
        replayedEvents.push(evTyped);
      }
    }
  }

  // 2. Build per-src effect queues from captured @effect.done / @effect.error
  const effectProvide = buildEffectProvide(events, options.effects ?? {});

  // 3. Run a fresh actor, collect snapshots
  const snapshots: StateGraphSnapshot<TContext>[] = [];

  const actor = createActor(machine, {
    provide: { effects: effectProvide },
  });

  const unsub = actor.subscribe((snap) => {
    snapshots.push(snap);
  });

  actor.start();
  for (const event of replayedEvents) {
    actor.send(event as TEvent);
  }
  actor.stop();
  unsub();

  return { snapshots, replayedEvents };
}

// ---------------------------------------------------------------------------
// Internal: build mock effect implementations from captured trace outputs
// ---------------------------------------------------------------------------

function buildEffectProvide(
  events: TraceEnvelope["events"],
  overrides: Record<string, EffectDefinition>,
): Record<string, EffectDefinition> {
  // Map effectId → src from @effect.started events
  const idToSrc = new Map<string, string>();
  for (const e of events) {
    if (e.type === "@effect.started") {
      idToSrc.set(e.effectId, e.src);
    }
  }

  // Build per-src ordered queues from settled effect events
  const srcQueues = new Map<string, Array<{ ok: boolean; payload: unknown }>>();
  for (const e of events) {
    if (e.type === "@effect.done") {
      const src = idToSrc.get(e.effectId);
      if (!src) continue;
      if (!srcQueues.has(src)) srcQueues.set(src, []);
      srcQueues.get(src)!.push({ ok: true, payload: e.output });
    } else if (e.type === "@effect.error") {
      const src = idToSrc.get(e.effectId);
      if (!src) continue;
      if (!srcQueues.has(src)) srcQueues.set(src, []);
      srcQueues.get(src)!.push({ ok: false, payload: e.error });
    }
  }

  // Build effect implementations from queues
  const provide: Record<string, EffectDefinition> = { ...overrides };
  for (const [src, queue] of srcQueues) {
    if (src in provide) continue; // caller override takes precedence
    let callIndex = 0;
    provide[src] = fromPromise(() => {
      const entry = queue[callIndex++];
      if (!entry) return Promise.resolve(undefined);
      return entry.ok
        ? Promise.resolve(entry.payload)
        : Promise.reject(entry.payload as Error);
    });
  }
  return provide;
}
