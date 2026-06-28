import { describe, expect, it, vi } from "vitest";
import {
  createActor,
  createMachine,
  type EffectControls,
  type MachineIR,
  type StateGraphEvent,
} from "@stategraph/core";
import {
  createCallbackEffectMock,
  createGuardBranchPlan,
  createInvalidEventPlan,
  createPathCoveragePlan,
  createPromiseEffectMock,
  createStateCoveragePlan,
  createTransitionCoveragePlan,
  defineAdapterConformanceSuite,
  emitVitestTests,
  enumerateStates,
  enumerateTransitions,
} from ".";

function fixtures() {
  const finite = createMachine({
    id: "finite",
    initial: "idle",
    states: {
      idle: { on: { START: { target: "active" } } },
      active: { on: { FINISH: { target: "done" }, NOOP: {} } },
      done: { type: "final" },
    },
  });

  const hierarchical = createMachine({
    id: "wizard",
    initial: "editing",
    states: {
      editing: {
        initial: "name",
        states: {
          name: { on: { NEXT: { target: "email" } } },
          email: { on: { SUBMIT: { target: "done" } } },
        },
      },
      done: { type: "final" },
    },
  });

  const parallel = createMachine({
    id: "player",
    type: "parallel",
    states: {
      playback: {
        initial: "paused",
        states: {
          paused: { on: { PLAY: { target: "playing" } } },
          playing: { on: { PAUSE: { target: "paused" } } },
        },
      },
      panel: {
        initial: "closed",
        states: {
          closed: { on: { TOGGLE: { target: "open" } } },
          open: { on: { TOGGLE: { target: "closed" } } },
        },
      },
    },
  });

  const guarded = createMachine({
    id: "guarded",
    initial: "idle",
    states: {
      idle: { on: { SUBMIT: { target: "done", guard: "canSubmit" } } },
      done: { type: "final" },
    },
  });

  const effectful = createMachine({
    id: "effectful",
    initial: "loading",
    states: {
      loading: { invoke: { src: "load", onDone: { target: "ready" } } },
      ready: {},
    },
  });

  return { finite, hierarchical, parallel, guarded, effectful };
}

describe("@stategraph/testing", () => {
  it("enumerates states and transitions deterministically", () => {
    const { parallel } = fixtures();
    const firstStates = enumerateStates(parallel);
    const secondStates = enumerateStates(parallel.toIR());
    const firstTransitions = enumerateTransitions(parallel);
    const secondTransitions = enumerateTransitions(parallel.toIR());

    expect(firstStates).toEqual(secondStates);
    expect(firstStates.map((state) => state.id)).toEqual(
      [...firstStates.map((state) => state.id)].sort(),
    );
    expect(firstTransitions).toEqual(secondTransitions);
    expect(firstTransitions.map((transition) => transition.event)).toContain("PLAY");
    expect(firstStates.map((state) => state.id)).toContain("player.playback.paused");
  });

  it("creates deterministic coverage plans for states, transitions, paths, invalid events, and guards", () => {
    const { finite, guarded, parallel } = fixtures();
    const statePlan = createStateCoveragePlan(finite);
    const transitionPlan = createTransitionCoveragePlan(finite);
    const pathPlan = createPathCoveragePlan(parallel, { maxDepth: 2, maxCases: 10 });
    const invalidPlan = createInvalidEventPlan(finite, { invalidEvent: { type: "BOGUS" } });
    const guardPlan = createGuardBranchPlan(guarded, {
      fixtures: [
        {
          guard: "canSubmit",
          enabledEvents: [{ type: "SUBMIT", valid: true }],
          disabledEvents: [{ type: "SUBMIT", valid: false }],
        },
      ],
    });

    expect(statePlan.cases.map((testCase) => testCase.expected.state)).toContain("finite.done");
    expect(transitionPlan.cases.map((testCase) => testCase.events.at(-1)?.type)).toContain("START");
    expect(pathPlan.cases.length).toBeGreaterThan(0);
    expect(pathPlan.cases.length).toBeLessThanOrEqual(10);
    expect(invalidPlan.cases.every((testCase) => testCase.expected.unchanged)).toBe(true);
    expect(guardPlan.cases.map((testCase) => testCase.meta?.branch)).toEqual([
      "enabled",
      "disabled",
    ]);

    expect(createPathCoveragePlan(parallel, { maxDepth: 2, maxCases: 10 })).toEqual(pathPlan);
  });

  it("emits deterministic Vitest source for generated plans", () => {
    const { finite } = fixtures();
    const plans = [createStateCoveragePlan(finite), createTransitionCoveragePlan(finite)];
    const source = emitVitestTests(plans, { suiteName: "finite generated tests" });

    expect(source).toBe(emitVitestTests(plans, { suiteName: "finite generated tests" }));
    expect(source).toContain('import { describe, expect, it } from "vitest";');
    expect(source).toContain("finite generated tests");
    expect(source).toContain("plan.cases.length");
  });

  it("provides controllable promise and callback effect mocks", async () => {
    const promiseMock = createPromiseEffectMock<{ id: string }, string>();
    const promiseControls = createControls<string>();
    const promise = promiseMock.effect.run({ id: "1" }, promiseControls);
    expect(promiseMock.calls).toHaveLength(1);
    promiseMock.resolve("ok");
    await expect(promise).resolves.toBe("ok");

    const callbackMock = createCallbackEffectMock<{ channel: string }>();
    const callbackControls = createControls<unknown>();
    const cleanup = callbackMock.effect.run({ channel: "events" }, callbackControls);
    const listener = vi.fn();
    callbackControls.receive(listener);
    callbackMock.sendBack({ type: "PING" });
    expect(listener).toHaveBeenCalledWith({ type: "PING" });
    if (typeof cleanup === "function") cleanup();
    expect(callbackMock.cleanupCalls).toBe(1);
  });

  it("defines a framework-neutral adapter conformance suite", async () => {
    const machine = createMachine({
      id: "adapter",
      initial: "idle",
      states: {
        idle: { on: { NEXT: { target: "done" }, NOOP: {} } },
        done: { type: "final" },
      },
    });

    const suite = defineAdapterConformanceSuite({
      name: "direct",
      createMachine: () => machine,
      dispatchEvent: { type: "NEXT" },
      noopEvent: { type: "NOOP" },
      expectInitial: (snapshot) => expect(snapshot.value).toBe("idle"),
      expectAfterDispatch: (snapshot) => expect(snapshot.value).toBe("done"),
      mount: ({ machine: mountedMachine, onSnapshot, selector, onSelected }) => {
        const actor = createActor(mountedMachine).start();
        const unsubscribers = [
          onSnapshot ? actor.subscribe(onSnapshot) : undefined,
          selector && onSelected ? actor.select(selector, onSelected) : undefined,
        ].filter((unsubscribe): unsubscribe is () => void => Boolean(unsubscribe));
        let cleaned = false;
        return {
          actor,
          send: (event) => actor.send(event),
          getSnapshot: () => actor.getSnapshot(),
          handle: undefined,
          cleanup: () => {
            if (cleaned) return;
            cleaned = true;
            for (const unsubscribe of unsubscribers) unsubscribe();
            actor.stop();
          },
        };
      },
    });

    expect(suite.name).toBe("direct adapter conformance");
    for (const test of suite.tests) await test.run();
  });

  it("keeps fixture IR serializable for hierarchical and effectful machines", () => {
    const { effectful, hierarchical } = fixtures();
    const irs: MachineIR[] = [effectful.toIR(), hierarchical.toIR()];

    expect(JSON.stringify(irs)).toContain("effectful");
    expect(effectful.toIR().effects).toContain("load");
  });
});

function createControls<TOutput>(): EffectControls<TOutput> {
  const listeners = new Set<(event: StateGraphEvent) => void>();
  return {
    signal: new AbortController().signal,
    sendBack(event) {
      for (const listener of listeners) listener(event);
    },
    receive(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    resolve() {
      return undefined;
    },
    reject() {
      return undefined;
    },
  };
}
