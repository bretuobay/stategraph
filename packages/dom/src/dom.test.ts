// @vitest-environment happy-dom

import { createMachine, fromCallback, setup } from "@stategraph/core";
import type { StateGraphSnapshot } from "@stategraph/core";
import { defineAdapterConformanceSuite } from "@stategraph/testing";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { bindEvent, mountActor, onSnapshot, type StateEventOrMapper } from ".";

// ---------------------------------------------------------------------------
// Shared test machine
// ---------------------------------------------------------------------------

type ToggleEvent = { type: "TOGGLE" } | { type: "NOOP" };

function makeToggleMachine() {
  return createMachine<unknown, ToggleEvent>({
    id: "toggle",
    initial: "off",
    states: {
      off: { on: { TOGGLE: { target: "on" }, NOOP: {} } },
      on: { on: { TOGGLE: { target: "off" } } },
    },
  });
}

// ---------------------------------------------------------------------------
// mountActor
// ---------------------------------------------------------------------------

describe("mountActor", () => {
  it("creates and starts an actor", () => {
    const { actor, cleanup } = mountActor(makeToggleMachine());
    expect(actor.getSnapshot().status).toBe("active");
    cleanup();
  });

  it("returns the correct initial state", () => {
    const { actor, cleanup } = mountActor(makeToggleMachine());
    expect(actor.getSnapshot().value).toBe("off");
    cleanup();
  });

  it("accepts actorOptions and forwards them to core", () => {
    const machine = makeToggleMachine();
    const { actor, cleanup } = mountActor(machine, { id: "custom-id" });
    expect(actor.getSnapshot().status).toBe("active");
    cleanup();
  });

  it("cleanup stops the actor", () => {
    const { actor, cleanup } = mountActor(makeToggleMachine());
    cleanup();
    expect(actor.getSnapshot().status).toBe("stopped");
  });

  it("cleanup is idempotent — safe to call multiple times", () => {
    const { actor, cleanup } = mountActor(makeToggleMachine());
    expect(() => {
      cleanup();
      cleanup();
      cleanup();
    }).not.toThrow();
    expect(actor.getSnapshot().status).toBe("stopped");
  });

  it("invokes core effect cleanup when the actor stops", () => {
    const effectCleanup = vi.fn();
    const machine = setup({
      effects: { watch: fromCallback(() => effectCleanup) },
    }).createMachine({
      id: "effect-lifecycle",
      initial: "active",
      states: { active: { invoke: { src: "watch" } } },
    });

    const { cleanup } = mountActor(machine);
    expect(effectCleanup).not.toHaveBeenCalled();
    cleanup();
    expect(effectCleanup).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// bindEvent — static state event
// ---------------------------------------------------------------------------

describe("bindEvent (static event)", () => {
  it("registers a listener and sends the event on DOM trigger", () => {
    const machine = makeToggleMachine();
    const { actor, cleanup } = mountActor(machine);
    const btn = document.createElement("button");

    const unsub = bindEvent(btn, "click", actor, { type: "TOGGLE" });
    expect(actor.getSnapshot().value).toBe("off");

    btn.click();
    expect(actor.getSnapshot().value).toBe("on");

    unsub();
    cleanup();
  });

  it("sends a second event after a second click", () => {
    const machine = makeToggleMachine();
    const { actor, cleanup } = mountActor(machine);
    const btn = document.createElement("button");

    const unsub = bindEvent(btn, "click", actor, { type: "TOGGLE" });
    btn.click();
    btn.click();
    expect(actor.getSnapshot().value).toBe("off"); // toggled twice

    unsub();
    cleanup();
  });

  it("unsubscribe removes the listener — further DOM events are ignored", () => {
    const machine = makeToggleMachine();
    const { actor, cleanup } = mountActor(machine);
    const btn = document.createElement("button");

    const unsub = bindEvent(btn, "click", actor, { type: "TOGGLE" });
    unsub();

    btn.click(); // listener already removed
    expect(actor.getSnapshot().value).toBe("off");

    cleanup();
  });

  it("unsubscribe is idempotent", () => {
    const machine = makeToggleMachine();
    const { actor, cleanup } = mountActor(machine);
    const btn = document.createElement("button");

    const unsub = bindEvent(btn, "click", actor, { type: "TOGGLE" });
    expect(() => {
      unsub();
      unsub();
    }).not.toThrow();
    cleanup();
  });

  it("multiple bindEvent calls coexist independently", () => {
    const machine = makeToggleMachine();
    const { actor, cleanup } = mountActor(machine);
    const btn = document.createElement("button");

    const unsub1 = bindEvent(btn, "click", actor, { type: "TOGGLE" });
    const unsub2 = bindEvent(btn, "click", actor, { type: "NOOP" });

    btn.click(); // fires both: TOGGLE then NOOP
    // TOGGLE → "on"; NOOP → stays "on"
    expect(actor.getSnapshot().value).toBe("on");

    unsub1();
    unsub2();
    cleanup();
  });
});

// ---------------------------------------------------------------------------
// bindEvent — mapping function
// ---------------------------------------------------------------------------

describe("bindEvent (mapping function)", () => {
  it("calls the mapper with the DOM event and sends the returned state event", () => {
    type InputEvent = { type: "SET"; value: string };
    const machine = setup<{ value: string }, InputEvent>({}).createMachine({
      id: "input",
      context: { value: "" },
      initial: "idle",
      states: { idle: {} },
    });

    const { actor, cleanup } = mountActor(machine);
    const input = document.createElement("input");

    const mapFn = vi.fn((domEvent: Event) => ({
      type: "SET" as const,
      value: (domEvent.target as HTMLInputElement).value,
    }));

    const unsub = bindEvent(input, "input", actor, mapFn);

    Object.defineProperty(input, "value", { value: "hello", configurable: true });
    input.dispatchEvent(new Event("input"));

    expect(mapFn).toHaveBeenCalledTimes(1);
    expect(mapFn).toHaveBeenCalledWith(expect.any(Event));
    unsub();
    cleanup();
  });

  it("does not call the mapper after unsubscribe", () => {
    const mapFn = vi.fn(() => ({ type: "TOGGLE" as const }));
    const machine = makeToggleMachine();
    const { actor, cleanup } = mountActor(machine);
    const btn = document.createElement("button");

    const unsub = bindEvent(btn, "click", actor, mapFn);
    unsub();
    btn.click();

    expect(mapFn).not.toHaveBeenCalled();
    cleanup();
  });
});

// ---------------------------------------------------------------------------
// onSnapshot
// ---------------------------------------------------------------------------

describe("onSnapshot", () => {
  it("calls the handler when the actor emits a new snapshot", () => {
    const machine = makeToggleMachine();
    const { actor, cleanup } = mountActor(machine);
    const snapshots: StateGraphSnapshot<unknown, ToggleEvent>[] = [];

    const unsub = onSnapshot(actor, (s) => snapshots.push(s));
    actor.send({ type: "TOGGLE" });
    expect(snapshots.length).toBeGreaterThan(0);
    expect(snapshots.at(-1)?.value).toBe("on");

    unsub();
    cleanup();
  });

  it("stops calling handler after unsubscribe", () => {
    const machine = makeToggleMachine();
    const { actor, cleanup } = mountActor(machine);
    const handler = vi.fn();

    const unsub = onSnapshot(actor, handler);
    // core.subscribe may call once with the current snapshot on attach
    const callsAtSubscription = handler.mock.calls.length;
    unsub();

    actor.send({ type: "TOGGLE" });
    // No additional calls after unsubscribe
    expect(handler).toHaveBeenCalledTimes(callsAtSubscription);
    cleanup();
  });

  it("multiple subscriptions receive snapshots independently", () => {
    const machine = makeToggleMachine();
    const { actor, cleanup } = mountActor(machine);
    const snapshots1: unknown[] = [];
    const snapshots2: unknown[] = [];

    const unsub1 = onSnapshot(actor, (s) => snapshots1.push(s.value));
    const unsub2 = onSnapshot(actor, (s) => snapshots2.push(s.value));

    actor.send({ type: "TOGGLE" });

    expect(snapshots1).toContain("on");
    expect(snapshots2).toContain("on");

    unsub1();
    unsub2();
    cleanup();
  });
});

// ---------------------------------------------------------------------------
// Adapter conformance suite
// ---------------------------------------------------------------------------

const conformanceSuite = defineAdapterConformanceSuite<unknown, ToggleEvent, null>({
  name: "dom",
  createMachine: makeToggleMachine,
  dispatchEvent: { type: "TOGGLE" },
  noopEvent: { type: "NOOP" },
  expectInitial: (snapshot) => expect(snapshot.value).toBe("off"),
  expectAfterDispatch: (snapshot) => expect(snapshot.value).toBe("on"),

  mount: ({ machine, options, onSnapshot: onSnap, selector, onSelected }) => {
    const { actor, cleanup: stopActor } = mountActor(machine, options);

    const unsubs: Array<() => void> = [];

    // Provide initial + subsequent snapshots for conformance test
    if (onSnap) {
      onSnap(actor.getSnapshot());
      unsubs.push(onSnapshot(actor, onSnap));
    }

    // Selector subscription: call once with initial, then on changes
    if (selector && onSelected) {
      let last = selector(actor.getSnapshot());
      onSelected(last);
      unsubs.push(
        onSnapshot(actor, (snap) => {
          const value = selector(snap);
          if (!Object.is(value, last)) {
            last = value;
            onSelected(value);
          }
        }),
      );
    }

    return {
      actor,
      handle: null,
      send: (event) => actor.send(event),
      getSnapshot: () => actor.getSnapshot(),
      cleanup: () => {
        for (const u of unsubs) u();
        stopActor();
      },
    };
  },
});

describe(conformanceSuite.name, () => {
  for (const test of conformanceSuite.tests) {
    it(test.name, () => test.run());
  }
});

// ---------------------------------------------------------------------------
// Type tests
// ---------------------------------------------------------------------------

describe("type tests", () => {
  it("bindEvent stateEvent accepts static event or mapping function", () => {
    type MyEvent = { type: "GO" } | { type: "STOP" };
    expectTypeOf<StateEventOrMapper<MyEvent>>().toEqualTypeOf<
      MyEvent | ((domEvent: Event) => MyEvent)
    >();
  });

  it("mountActor returns typed actor and cleanup", () => {
    type Mounted = ReturnType<typeof mountActor<unknown, ToggleEvent>>;
    expectTypeOf<Mounted["actor"]["getSnapshot"]>().toBeFunction();
    expectTypeOf<Mounted["cleanup"]>().toEqualTypeOf<() => void>();
  });

  it("onSnapshot handler receives typed snapshots", () => {
    type ActorType = ReturnType<typeof mountActor<unknown, ToggleEvent>>["actor"];
    expectTypeOf(onSnapshot<unknown, ToggleEvent>).parameters.toMatchTypeOf<
      [ActorType, (snapshot: StateGraphSnapshot<unknown, ToggleEvent>) => void]
    >();
  });
});

// ---------------------------------------------------------------------------
// After each: safety net
// ---------------------------------------------------------------------------

const toCleanup: Array<() => void> = [];
afterEach(() => {
  for (const fn of toCleanup.splice(0)) fn();
});
