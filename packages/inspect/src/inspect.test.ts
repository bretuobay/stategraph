import { assign, createActor, createMachine, fromPromise, setup } from "@stategraph/core";
import { describe, expect, it, vi } from "vitest";
import { createTraceRecorder } from "./recorder";
import { replayTrace } from "./replay";
import { CURRENT_SCHEMA_VERSION } from "./schema";
import { createDevtoolsBridge, isBridgeMessage } from "./transport";
import {
  deserializeEnvelope,
  InvalidTraceEnvelopeError,
  parseTraceEnvelope,
  serializeEnvelope,
  UnsupportedSchemaVersionError,
} from "./validate";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

function makeMachine() {
  return setup({
    actions: {
      increment: assign<{ count: number }>(({ context }) => ({ count: context.count + 1 })),
    },
  }).createMachine({
    id: "counter",
    context: { count: 0 },
    initial: "idle",
    states: {
      idle: {
        on: {
          INC: { target: "idle", actions: ["increment"], reenter: true },
          FINISH: { target: "done" },
        },
      },
      done: { type: "final" },
    },
  });
}

function makeEffectMachine() {
  return setup({
    effects: {
      load: fromPromise<null, { value: number }>(({ signal }) => {
        void signal;
        return Promise.resolve({ value: 42 });
      }),
    },
    actions: {
      setData: assign<{ data: number | null }>(({ event }) => ({
        data: (event as unknown as { output: { value: number } }).output?.value ?? null,
      })),
    },
  }).createMachine({
    id: "loader",
    context: { data: null as number | null },
    initial: "loading",
    states: {
      loading: {
        invoke: { src: "load", input: null, onDone: { target: "loaded", actions: ["setData"] } },
      },
      loaded: { type: "final" },
    },
  });
}

// ---------------------------------------------------------------------------
// Schema / validate
// ---------------------------------------------------------------------------

describe("parseTraceEnvelope", () => {
  it("accepts a valid envelope", () => {
    const raw = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      sessionId: "sess-1",
      machineId: "counter",
      actorId: "counter:actor",
      createdAt: Date.now(),
      events: [],
    };
    const envelope = parseTraceEnvelope(raw);
    expect(envelope.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(envelope.events).toHaveLength(0);
  });

  it("accepts a minor version in the same major series", () => {
    const raw = {
      schemaVersion: "1.5",
      sessionId: "s",
      machineId: "m",
      actorId: "a",
      createdAt: 0,
      events: [],
    };
    expect(() => parseTraceEnvelope(raw)).not.toThrow();
  });

  it("throws UnsupportedSchemaVersionError for unknown major version", () => {
    const raw = {
      schemaVersion: "99.0",
      sessionId: "s",
      machineId: "m",
      actorId: "a",
      createdAt: 0,
      events: [],
    };
    expect(() => parseTraceEnvelope(raw)).toThrow(UnsupportedSchemaVersionError);
  });

  it("throws InvalidTraceEnvelopeError for non-object input", () => {
    expect(() => parseTraceEnvelope("not an object")).toThrow(InvalidTraceEnvelopeError);
    expect(() => parseTraceEnvelope(null)).toThrow(InvalidTraceEnvelopeError);
  });

  it("throws InvalidTraceEnvelopeError for missing required fields", () => {
    expect(() => parseTraceEnvelope({ schemaVersion: "1.0" })).toThrow(InvalidTraceEnvelopeError);
  });

  it("drops unknown event types silently", () => {
    const raw = {
      schemaVersion: "1.0",
      sessionId: "s",
      machineId: "m",
      actorId: "a",
      createdAt: 0,
      events: [
        { seq: 1, ts: 0, actorId: "a", type: "@unknown.future.type", data: "whatever" },
        { seq: 2, ts: 1, actorId: "a", type: "@actor.stopped" },
      ],
    };
    const envelope = parseTraceEnvelope(raw);
    // Only the known @actor.stopped event should survive
    expect(envelope.events).toHaveLength(1);
    expect(envelope.events[0]?.type).toBe("@actor.stopped");
  });

  it("round-trips through serialize / deserialize", () => {
    const raw = {
      schemaVersion: "1.0",
      sessionId: "abc",
      machineId: "m",
      actorId: "a",
      createdAt: 123,
      events: [],
    };
    const envelope = parseTraceEnvelope(raw);
    const json = serializeEnvelope(envelope);
    const restored = deserializeEnvelope(json);
    expect(restored).toEqual(envelope);
  });

  it("throws InvalidTraceEnvelopeError on invalid JSON", () => {
    expect(() => deserializeEnvelope("{not json}")).toThrow(InvalidTraceEnvelopeError);
  });
});

// ---------------------------------------------------------------------------
// Recorder
// ---------------------------------------------------------------------------

describe("createTraceRecorder", () => {
  it("captures @actor.started and subsequent events", () => {
    const actor = createActor(makeMachine());
    const recorder = createTraceRecorder(actor, { machineId: "counter" });
    actor.start();
    actor.send({ type: "INC" });
    actor.stop();
    recorder.stop();

    const envelope = recorder.getEnvelope();
    expect(envelope.machineId).toBe("counter");
    expect(envelope.events.length).toBeGreaterThan(0);
    expect(envelope.events.some((e) => e.type === "@actor.started")).toBe(true);
    expect(envelope.events.some((e) => e.type === "@event.received")).toBe(true);
    expect(envelope.events.some((e) => e.type === "@transition.fired")).toBe(true);
    expect(envelope.events.some((e) => e.type === "@actor.stopped")).toBe(true);
  });

  it("sequences events monotonically", () => {
    const actor = createActor(makeMachine());
    const recorder = createTraceRecorder(actor, { machineId: "counter" });
    actor.start();
    actor.send({ type: "INC" });
    actor.send({ type: "INC" });
    recorder.stop();
    actor.stop();

    const seqs = recorder.getEnvelope().events.map((e) => e.seq);
    for (let i = 1; i < seqs.length; i++) {
      expect(seqs[i]!).toBeGreaterThan(seqs[i - 1]!);
    }
  });

  it("records action execution traces", () => {
    const actor = createActor(makeMachine());
    const recorder = createTraceRecorder(actor, { machineId: "counter" });
    actor.start();
    actor.send({ type: "INC" });
    recorder.stop();
    actor.stop();

    const envelope = recorder.getEnvelope();
    const actionEvents = envelope.events.filter((e) => e.type === "@action.executed");
    expect(actionEvents.length).toBeGreaterThan(0);
    expect(
      actionEvents.some(
        (e) => (e as { type: "@action.executed"; actionType: string }).actionType === "increment",
      ),
    ).toBe(true);
  });

  it("reset clears accumulated events", () => {
    const actor = createActor(makeMachine());
    const recorder = createTraceRecorder(actor, { machineId: "counter" });
    actor.start();
    expect(recorder.getEnvelope().events.length).toBeGreaterThan(0);
    recorder.reset();
    expect(recorder.getEnvelope().events).toHaveLength(0);
    recorder.stop();
    actor.stop();
  });

  it("stop is idempotent", () => {
    const actor = createActor(makeMachine());
    const recorder = createTraceRecorder(actor);
    actor.start();
    recorder.stop();
    expect(() => recorder.stop()).not.toThrow();
    actor.stop();
  });

  it("getEnvelope returns a snapshot (not a live reference)", () => {
    const actor = createActor(makeMachine());
    const recorder = createTraceRecorder(actor, { machineId: "counter" });
    actor.start();
    const snap1 = recorder.getEnvelope();
    actor.send({ type: "INC" });
    const snap2 = recorder.getEnvelope();
    expect(snap2.events.length).toBeGreaterThan(snap1.events.length);
    recorder.stop();
    actor.stop();
  });

  it("captures effect-related events", async () => {
    const machine = makeEffectMachine();
    const actor = createActor(machine);
    const recorder = createTraceRecorder(actor, { machineId: "loader" });
    actor.start();
    // Wait for the async effect to settle
    await new Promise((r) => setTimeout(r, 10));
    recorder.stop();
    actor.stop();

    const envelope = recorder.getEnvelope();
    expect(envelope.events.some((e) => e.type === "@effect.started")).toBe(true);
    expect(envelope.events.some((e) => e.type === "@effect.done")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Transport / DevtoolsBridge
// ---------------------------------------------------------------------------

describe("createDevtoolsBridge", () => {
  it("sends trace:event messages to the channel", () => {
    const messages: unknown[] = [];
    const channel = { postMessage: (msg: unknown) => messages.push(msg) };

    const actor = createActor(makeMachine());
    const bridge = createDevtoolsBridge(actor, { channel, machineId: "counter" });

    actor.start();
    actor.send({ type: "INC" });
    bridge.stop();
    actor.stop();

    expect(messages.length).toBeGreaterThan(0);
    expect(messages.some((m) => (m as { kind: string }).kind === "trace:event")).toBe(true);
  });

  it("isBridgeMessage correctly identifies bridge messages", () => {
    expect(isBridgeMessage({ kind: "trace:event", schemaVersion: "1.0" })).toBe(true);
    expect(isBridgeMessage({ kind: "trace:snapshot" })).toBe(true);
    expect(isBridgeMessage({ kind: "something-else" })).toBe(false);
    expect(isBridgeMessage(null)).toBe(false);
    expect(isBridgeMessage("string")).toBe(false);
  });

  it("respects a filter function", () => {
    const messages: unknown[] = [];
    const channel = { postMessage: (msg: unknown) => messages.push(msg) };

    const actor = createActor(makeMachine());
    const bridge = createDevtoolsBridge(actor, {
      channel,
      machineId: "counter",
      filter: (e) => e.type === "@transition.fired",
    });

    actor.start();
    actor.send({ type: "INC" });
    bridge.stop();
    actor.stop();

    const eventMessages = messages.filter((m) => (m as { kind: string }).kind === "trace:event");
    expect(
      eventMessages.every((m) => {
        const msg = m as { kind: "trace:event"; event: { type: string } };
        return msg.event.type === "@transition.fired";
      }),
    ).toBe(true);
  });

  it("getLog returns accumulated envelope", () => {
    const channel = { postMessage: vi.fn() };
    const actor = createActor(makeMachine());
    const bridge = createDevtoolsBridge(actor, { channel, machineId: "counter" });

    actor.start();
    actor.send({ type: "INC" });
    bridge.stop();
    actor.stop();

    const log = bridge.getLog();
    expect(log.machineId).toBe("counter");
    expect(log.events.length).toBeGreaterThan(0);
  });

  it("stop is idempotent", () => {
    const channel = { postMessage: vi.fn() };
    const actor = createActor(makeMachine());
    const bridge = createDevtoolsBridge(actor, { channel, machineId: "counter" });
    actor.start();
    bridge.stop();
    expect(() => bridge.stop()).not.toThrow();
    actor.stop();
  });
});

// ---------------------------------------------------------------------------
// Replay
// ---------------------------------------------------------------------------

describe("replayTrace", () => {
  it("produces snapshots from replayed events", () => {
    const machine = makeMachine();
    const actor = createActor(machine);
    const recorder = createTraceRecorder(actor, { machineId: "counter" });

    actor.start();
    actor.send({ type: "INC" });
    actor.send({ type: "INC" });
    recorder.stop();
    actor.stop();

    const envelope = recorder.getEnvelope();
    const result = replayTrace(machine, envelope);

    expect(result.replayedEvents).toHaveLength(2);
    expect(result.snapshots.length).toBeGreaterThan(0);
  });

  it("replays the correct state sequence", () => {
    const machine = setup({
      actions: { step: assign<{ step: number }>(({ context }) => ({ step: context.step + 1 })) },
    }).createMachine({
      id: "stepper",
      context: { step: 0 },
      initial: "a",
      states: {
        a: { on: { NEXT: { target: "b", actions: ["step"] } } },
        b: { on: { NEXT: { target: "c", actions: ["step"] } } },
        c: { type: "final" },
      },
    });

    const actor = createActor(machine);
    const recorder = createTraceRecorder(actor, { machineId: "stepper" });
    actor.start();
    actor.send({ type: "NEXT" });
    actor.send({ type: "NEXT" });
    recorder.stop();
    actor.stop();

    const envelope = recorder.getEnvelope();
    const result = replayTrace(machine, envelope);

    const stateValues = result.snapshots.map((s) => s.value);
    expect(stateValues).toContain("a");
    expect(stateValues).toContain("b");
    expect(stateValues).toContain("c");
  });

  it("replays async effect results from the trace", async () => {
    const machine = makeEffectMachine();
    const actor = createActor(machine);
    const recorder = createTraceRecorder(actor, { machineId: "loader" });

    actor.start();
    await new Promise((r) => setTimeout(r, 10));
    recorder.stop();
    actor.stop();

    const envelope = recorder.getEnvelope();
    const effectStarts = envelope.events.filter((e) => e.type === "@effect.started");
    expect(effectStarts.length).toBeGreaterThan(0);

    const result = replayTrace(machine, envelope);
    await new Promise((r) => setTimeout(r, 10));

    expect(result.snapshots.length).toBeGreaterThan(0);
  });

  it("accepts caller-provided effect overrides", () => {
    const machine = setup({
      effects: {
        load: fromPromise<null, { value: number }>(() => Promise.resolve({ value: 99 })),
      },
      actions: {
        setData: assign<{ data: number | null }>(({ event }) => ({
          data: (event as unknown as { output: { value: number } }).output?.value ?? null,
        })),
      },
    }).createMachine({
      id: "loader2",
      context: { data: null as number | null },
      initial: "loading",
      states: {
        loading: {
          invoke: { src: "load", input: null, onDone: { target: "done", actions: ["setData"] } },
        },
        done: { type: "final" },
      },
    });

    const originalActor = createActor(machine);
    const recorder = createTraceRecorder(originalActor, { machineId: "loader2" });
    originalActor.start();
    recorder.stop();

    const envelope = recorder.getEnvelope();
    const customEffect = fromPromise<null, { value: number }>(() =>
      Promise.resolve({ value: 999 }),
    );

    expect(() => replayTrace(machine, envelope, { effects: { load: customEffect } })).not.toThrow();

    originalActor.stop();
  });

  it("handles empty event lists without throwing", () => {
    const machine = createMachine({
      id: "trivial",
      initial: "idle",
      states: { idle: {} },
    });
    const envelope = {
      schemaVersion: "1.0",
      sessionId: "s",
      machineId: "trivial",
      actorId: "a",
      createdAt: Date.now(),
      events: [] as never[],
    };
    const result = replayTrace(machine, envelope);
    expect(result.replayedEvents).toHaveLength(0);
    expect(result.snapshots.length).toBeGreaterThan(0);
  });
});
