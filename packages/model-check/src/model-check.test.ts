import { createMachine, fromPromise, setup } from "@stategraph/core";
import type { MachineIR } from "@stategraph/core";
import { describe, expect, it } from "vitest";
import { check } from "./check";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/** Build a minimal raw MachineIR — bypasses createMachine validation for edge-case checks. */
function rawIR(overrides: Partial<MachineIR>): MachineIR {
  return {
    id: "test",
    states: [],
    transitions: [],
    events: [],
    guards: [],
    actions: [],
    effects: [],
    protocols: {},
    ...overrides,
  };
}

function baseState(
  id: string,
  opts: Partial<MachineIR["states"][number]> = {},
): MachineIR["states"][number] {
  return {
    id,
    key: id.includes(".") ? id.slice(id.lastIndexOf(".") + 1) : id,
    parent: id.includes(".") ? id.slice(0, id.lastIndexOf(".")) : null,
    type: "atomic",
    ...opts,
  };
}

function baseTx(
  source: string,
  event: string,
  target: string | null,
  opts: Partial<MachineIR["transitions"][number]> = {},
): MachineIR["transitions"][number] {
  return { source, event, target, guard: null, actions: [], effects: [], ...opts };
}

// ---------------------------------------------------------------------------
// INVALID_TARGET
// ---------------------------------------------------------------------------

describe("INVALID_TARGET", () => {
  it("flags a transition whose target cannot be resolved", () => {
    const ir = rawIR({
      states: [baseState("test"), baseState("test.idle", { parent: "test", type: "atomic" })],
      transitions: [baseTx("test.idle", "GO", "doesNotExist")],
    });
    const result = check(ir);
    const diag = result.diagnostics.find((d) => d.code === "INVALID_TARGET");
    expect(diag).toBeDefined();
    expect(diag?.severity).toBe("error");
    expect(result.passed).toBe(false);
  });

  it("does not flag a valid absolute target", () => {
    const machine = createMachine({
      id: "m",
      initial: "a",
      states: { a: { on: { GO: { target: "b" } } }, b: { type: "final" } },
    });
    const result = check(machine);
    const diag = result.diagnostics.filter((d) => d.code === "INVALID_TARGET");
    expect(diag).toHaveLength(0);
  });

  it("does not flag a targetless transition (null target)", () => {
    const ir = rawIR({
      states: [baseState("test"), baseState("test.idle", { parent: "test", type: "atomic" })],
      transitions: [baseTx("test.idle", "PING", null)],
    });
    const result = check(ir, {
      checks: {
        invalidTargets: true,
        unreachableStates: false,
        deadStates: false,
        deadTransitions: false,
        missingInitial: false,
        nondeterminism: false,
        effectsWithoutCancel: false,
      },
    });
    const diag = result.diagnostics.filter((d) => d.code === "INVALID_TARGET");
    expect(diag).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// MISSING_INITIAL
// ---------------------------------------------------------------------------

describe("MISSING_INITIAL", () => {
  it("flags a compound state with no initial declaration", () => {
    const ir = rawIR({
      states: [
        baseState("test", { type: "compound" }),
        baseState("test.a", { parent: "test" }),
        baseState("test.b", { parent: "test" }),
      ],
      transitions: [],
    });
    const result = check(ir);
    const diag = result.diagnostics.find((d) => d.code === "MISSING_INITIAL");
    expect(diag).toBeDefined();
    expect(diag?.stateId).toBe("test");
    expect(result.passed).toBe(false);
  });

  it("flags a compound state whose initial target does not exist as a child", () => {
    const ir = rawIR({
      states: [
        baseState("test", { type: "compound", initial: "nonexistent" }),
        baseState("test.a", { parent: "test" }),
      ],
      transitions: [],
    });
    const result = check(ir);
    const diag = result.diagnostics.find((d) => d.code === "MISSING_INITIAL");
    expect(diag).toBeDefined();
    expect(diag?.stateId).toBe("test");
  });

  it("does not flag a compound state with a valid initial", () => {
    const machine = createMachine({
      id: "m",
      initial: "a",
      states: { a: { type: "final" } },
    });
    const result = check(machine);
    const diag = result.diagnostics.filter((d) => d.code === "MISSING_INITIAL");
    expect(diag).toHaveLength(0);
  });

  it("does not flag atomic or final states", () => {
    const ir = rawIR({
      states: [
        baseState("test", { type: "compound", initial: "a" }),
        baseState("test.a", { parent: "test", type: "atomic" }),
        baseState("test.b", { parent: "test", type: "final" }),
      ],
      transitions: [],
    });
    const result = check(ir, {
      checks: {
        missingInitial: true,
        unreachableStates: false,
        deadStates: false,
        deadTransitions: false,
        invalidTargets: false,
        nondeterminism: false,
        effectsWithoutCancel: false,
      },
    });
    const diag = result.diagnostics.filter((d) => d.code === "MISSING_INITIAL");
    expect(diag).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// UNREACHABLE_STATE
// ---------------------------------------------------------------------------

describe("UNREACHABLE_STATE", () => {
  it("flags a state with no incoming transitions from the initial configuration", () => {
    const machine = createMachine({
      id: "m",
      initial: "a",
      states: {
        a: { on: { GO: { target: "b" } } },
        b: { type: "final" },
        orphan: { type: "final" }, // no transition points here
      },
    });
    const result = check(machine);
    const diag = result.diagnostics.find(
      (d) => d.code === "UNREACHABLE_STATE" && d.stateId === "m.orphan",
    );
    expect(diag).toBeDefined();
    expect(result.passed).toBe(false);
  });

  it("does not flag states reachable via transitions", () => {
    const machine = createMachine({
      id: "m",
      initial: "a",
      states: {
        a: { on: { GO: { target: "b" } } },
        b: { type: "final" },
      },
    });
    const result = check(machine);
    const unreachable = result.diagnostics.filter((d) => d.code === "UNREACHABLE_STATE");
    expect(unreachable).toHaveLength(0);
  });

  it("does not flag the root state", () => {
    const machine = createMachine({
      id: "m",
      initial: "a",
      states: { a: { type: "final" } },
    });
    const result = check(machine, {
      checks: {
        unreachableStates: true,
        deadStates: false,
        deadTransitions: false,
        invalidTargets: false,
        nondeterminism: false,
        missingInitial: false,
        effectsWithoutCancel: false,
      },
    });
    const unreachable = result.diagnostics.filter((d) => d.code === "UNREACHABLE_STATE");
    expect(unreachable).toHaveLength(0);
  });

  it("marks children of reachable parallel states as reachable", () => {
    const machine = createMachine({
      id: "m",
      initial: "par",
      states: {
        par: {
          type: "parallel",
          states: {
            left: { type: "final" },
            right: { type: "final" },
          },
        },
      },
    });
    const result = check(machine, {
      checks: {
        unreachableStates: true,
        deadStates: false,
        deadTransitions: false,
        invalidTargets: false,
        nondeterminism: false,
        missingInitial: false,
        effectsWithoutCancel: false,
      },
    });
    const unreachable = result.diagnostics.filter((d) => d.code === "UNREACHABLE_STATE");
    expect(unreachable).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// DEAD_STATE
// ---------------------------------------------------------------------------

describe("DEAD_STATE", () => {
  it("flags an atomic non-final state with no outgoing transitions", () => {
    const machine = createMachine({
      id: "m",
      initial: "a",
      states: {
        a: { on: { GO: { target: "stuck" } } },
        stuck: {}, // atomic, not final, no transitions
      },
    });
    const result = check(machine);
    const diag = result.diagnostics.find((d) => d.code === "DEAD_STATE" && d.stateId === "m.stuck");
    expect(diag).toBeDefined();
    expect(diag?.severity).toBe("error");
    expect(result.passed).toBe(false);
  });

  it("does not flag a final state", () => {
    const machine = createMachine({
      id: "m",
      initial: "a",
      states: {
        a: { on: { DONE: { target: "done" } } },
        done: { type: "final" },
      },
    });
    const result = check(machine, {
      checks: {
        deadStates: true,
        unreachableStates: false,
        deadTransitions: false,
        invalidTargets: false,
        nondeterminism: false,
        missingInitial: false,
        effectsWithoutCancel: false,
      },
    });
    const diag = result.diagnostics.filter((d) => d.code === "DEAD_STATE");
    expect(diag).toHaveLength(0);
  });

  it("does not flag an atomic state that has outgoing transitions", () => {
    const machine = createMachine({
      id: "m",
      initial: "idle",
      states: {
        idle: { on: { GO: { target: "done" } } },
        done: { type: "final" },
      },
    });
    const result = check(machine, {
      checks: {
        deadStates: true,
        unreachableStates: false,
        deadTransitions: false,
        invalidTargets: false,
        nondeterminism: false,
        missingInitial: false,
        effectsWithoutCancel: false,
      },
    });
    const diag = result.diagnostics.filter((d) => d.code === "DEAD_STATE");
    expect(diag).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// DEAD_TRANSITION
// ---------------------------------------------------------------------------

describe("DEAD_TRANSITION", () => {
  it("flags a transition superseded by a prior unguarded transition", () => {
    const machine = setup({
      guards: { alwaysFalse: () => false },
    }).createMachine({
      id: "m",
      initial: "idle",
      states: {
        idle: {
          on: {
            GO: [
              { target: "a" }, // unguarded — always fires
              { target: "b", guard: "alwaysFalse" }, // dead — never reached
            ],
          },
        },
        a: { type: "final" },
        b: { type: "final" },
      },
    });
    const result = check(machine);
    const diag = result.diagnostics.find((d) => d.code === "DEAD_TRANSITION");
    expect(diag).toBeDefined();
    expect(diag?.transitionEvent).toBe("GO");
    expect(result.passed).toBe(false);
  });

  it("does not flag a guarded transition before an unguarded fallback", () => {
    const machine = setup({
      guards: { isValid: () => true },
    }).createMachine({
      id: "m",
      initial: "idle",
      states: {
        idle: {
          on: {
            SUBMIT: [
              { target: "ok", guard: "isValid" },
              { target: "err" }, // fallback — valid pattern
            ],
          },
        },
        ok: { type: "final" },
        err: { type: "final" },
      },
    });
    const result = check(machine, {
      checks: {
        deadTransitions: true,
        unreachableStates: false,
        deadStates: false,
        invalidTargets: false,
        nondeterminism: false,
        missingInitial: false,
        effectsWithoutCancel: false,
      },
    });
    const diag = result.diagnostics.filter((d) => d.code === "DEAD_TRANSITION");
    expect(diag).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// NONDETERMINISTIC_TRANSITION
// ---------------------------------------------------------------------------

describe("NONDETERMINISTIC_TRANSITION", () => {
  it("flags two or more unguarded transitions for the same event from the same state", () => {
    const machine = createMachine({
      id: "m",
      initial: "idle",
      states: {
        idle: {
          on: {
            GO: [
              { target: "a" }, // both unguarded
              { target: "b" },
            ],
          },
        },
        a: { type: "final" },
        b: { type: "final" },
      },
    });
    const result = check(machine);
    const diag = result.diagnostics.find((d) => d.code === "NONDETERMINISTIC_TRANSITION");
    expect(diag).toBeDefined();
    expect(diag?.transitionEvent).toBe("GO");
    expect(result.passed).toBe(false);
  });

  it("does not flag two guarded transitions for the same event", () => {
    const machine = setup({
      guards: { isA: () => true, isB: () => false },
    }).createMachine({
      id: "m",
      initial: "idle",
      states: {
        idle: {
          on: {
            GO: [
              { target: "a", guard: "isA" },
              { target: "b", guard: "isB" },
            ],
          },
        },
        a: { type: "final" },
        b: { type: "final" },
      },
    });
    const result = check(machine, {
      checks: {
        nondeterminism: true,
        unreachableStates: false,
        deadStates: false,
        deadTransitions: false,
        invalidTargets: false,
        missingInitial: false,
        effectsWithoutCancel: false,
      },
    });
    const diag = result.diagnostics.filter((d) => d.code === "NONDETERMINISTIC_TRANSITION");
    expect(diag).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// EFFECT_WITHOUT_CANCEL
// ---------------------------------------------------------------------------

describe("EFFECT_WITHOUT_CANCEL", () => {
  it("flags an invoke with no onDone and no onError", () => {
    const machine = setup({
      effects: {
        heartbeat: fromPromise(() => Promise.resolve(null)),
      },
    }).createMachine({
      id: "m",
      initial: "active",
      states: {
        active: {
          invoke: { src: "heartbeat" }, // no onDone, no onError
          on: { STOP: { target: "done" } },
        },
        done: { type: "final" },
      },
    });
    const result = check(machine, {
      checks: {
        effectsWithoutCancel: true,
        unreachableStates: false,
        deadStates: false,
        deadTransitions: false,
        invalidTargets: false,
        nondeterminism: false,
        missingInitial: false,
      },
    });
    const diag = result.diagnostics.find((d) => d.code === "EFFECT_WITHOUT_CANCEL");
    expect(diag).toBeDefined();
    expect(diag?.severity).toBe("warning");
  });

  it("does not flag an invoke that has onDone", () => {
    const machine = setup({
      effects: { load: fromPromise(() => Promise.resolve(null)) },
    }).createMachine({
      id: "m",
      initial: "loading",
      states: {
        loading: {
          invoke: { src: "load", onDone: "loaded" },
        },
        loaded: { type: "final" },
      },
    });
    const result = check(machine, {
      checks: {
        effectsWithoutCancel: true,
        unreachableStates: false,
        deadStates: false,
        deadTransitions: false,
        invalidTargets: false,
        nondeterminism: false,
        missingInitial: false,
      },
    });
    const diag = result.diagnostics.filter((d) => d.code === "EFFECT_WITHOUT_CANCEL");
    expect(diag).toHaveLength(0);
  });

  it("is skipped when only a raw MachineIR is provided", () => {
    const ir = rawIR({
      states: [baseState("test"), baseState("test.a", { parent: "test" })],
      effects: ["myEffect"],
    });
    const result = check(ir, {
      checks: {
        effectsWithoutCancel: true,
        unreachableStates: false,
        deadStates: false,
        deadTransitions: false,
        invalidTargets: false,
        nondeterminism: false,
        missingInitial: false,
      },
    });
    // No registry → check is skipped, no diagnostic
    const diag = result.diagnostics.filter((d) => d.code === "EFFECT_WITHOUT_CANCEL");
    expect(diag).toHaveLength(0);
  });

  it("warning-only results keep passed: true", () => {
    const machine = setup({
      effects: { heartbeat: fromPromise(() => Promise.resolve(null)) },
    }).createMachine({
      id: "m",
      initial: "active",
      states: {
        active: {
          invoke: { src: "heartbeat" },
          on: { STOP: { target: "done" } },
        },
        done: { type: "final" },
      },
    });
    const result = check(machine, {
      checks: {
        effectsWithoutCancel: true,
        unreachableStates: false,
        deadStates: false,
        deadTransitions: false,
        invalidTargets: false,
        nondeterminism: false,
        missingInitial: false,
      },
    });
    expect(result.diagnostics.some((d) => d.code === "EFFECT_WITHOUT_CANCEL")).toBe(true);
    expect(result.passed).toBe(true); // warnings don't fail passed
  });
});

// ---------------------------------------------------------------------------
// Check config: disabling individual checks
// ---------------------------------------------------------------------------

describe("config", () => {
  it("passes a valid machine with all checks enabled", () => {
    const machine = createMachine({
      id: "m",
      initial: "a",
      states: {
        a: { on: { GO: { target: "b" } } },
        b: { type: "final" },
      },
    });
    const result = check(machine);
    expect(result.passed).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("only runs enabled checks", () => {
    const machine = createMachine({
      id: "m",
      initial: "a",
      states: {
        a: { on: { GO: { target: "stuck" } } },
        stuck: {}, // dead state
      },
    });
    const result = check(machine, {
      checks: {
        deadStates: false,
        unreachableStates: false,
        deadTransitions: false,
        invalidTargets: false,
        nondeterminism: false,
        missingInitial: false,
        effectsWithoutCancel: false,
      },
    });
    expect(result.diagnostics).toHaveLength(0);
    expect(result.passed).toBe(true);
  });

  it("includes correct stats without bounded analysis", () => {
    const machine = createMachine({
      id: "m",
      initial: "a",
      states: { a: { type: "final" } },
    });
    const result = check(machine);
    expect(result.stats.bounded).toBe(false);
    expect(result.stats.hitLimit).toBe(false);
    expect(result.stats.statesAnalyzed).toBeGreaterThan(0);
    expect(result.stats.durationMs).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// Bounded BFS
// ---------------------------------------------------------------------------

describe("bounded BFS", () => {
  it("completes bounded analysis on a simple machine with cycles", () => {
    const machine = createMachine({
      id: "cycle",
      initial: "a",
      states: {
        a: { on: { GO: { target: "b" } } },
        b: { on: { BACK: { target: "a" } } },
      },
    });
    const result = check(machine, {
      checks: {
        unreachableStates: false,
        deadStates: false,
        deadTransitions: false,
        invalidTargets: false,
        nondeterminism: false,
        missingInitial: false,
        effectsWithoutCancel: false,
      },
      bounded: {
        enabled: true,
        maxPathDepth: 100,
        maxStatesExplored: 10_000,
        maxTransitions: 100_000,
        maxCycleLength: 20,
        timeoutMs: 5_000,
      },
    });
    expect(result.stats.bounded).toBe(true);
    expect(result.stats.hitLimit).toBe(false);
    expect(result.stats.statesAnalyzed).toBeGreaterThan(0);
  });

  it("sets hitLimit when maxStatesExplored is exceeded", () => {
    const machine = createMachine({
      id: "cycle",
      initial: "a",
      states: {
        a: { on: { GO: { target: "b" } } },
        b: { on: { BACK: { target: "a" } } },
      },
    });
    const result = check(machine, {
      checks: {
        unreachableStates: false,
        deadStates: false,
        deadTransitions: false,
        invalidTargets: false,
        nondeterminism: false,
        missingInitial: false,
        effectsWithoutCancel: false,
      },
      bounded: {
        enabled: true,
        maxPathDepth: 1_000,
        maxStatesExplored: 1,
        maxTransitions: 1_000,
        maxCycleLength: 20,
        timeoutMs: 5_000,
      },
    });
    expect(result.stats.bounded).toBe(true);
    expect(result.stats.hitLimit).toBe(true);
  });

  it("sets hitLimit when maxTransitions is exceeded", () => {
    const machine = createMachine({
      id: "cycle",
      initial: "a",
      states: {
        a: { on: { GO: { target: "b" }, STAY: { target: "a" } } },
        b: { on: { BACK: { target: "a" } } },
      },
    });
    const result = check(machine, {
      checks: {
        unreachableStates: false,
        deadStates: false,
        deadTransitions: false,
        invalidTargets: false,
        nondeterminism: false,
        missingInitial: false,
        effectsWithoutCancel: false,
      },
      bounded: {
        enabled: true,
        maxPathDepth: 1_000,
        maxStatesExplored: 10_000,
        maxTransitions: 1,
        maxCycleLength: 20,
        timeoutMs: 5_000,
      },
    });
    expect(result.stats.bounded).toBe(true);
    expect(result.stats.hitLimit).toBe(true);
  });

  it("sets hitLimit when maxPathDepth is reached", () => {
    const machine = createMachine({
      id: "cycle",
      initial: "a",
      states: {
        a: { on: { GO: { target: "b" } } },
        b: { on: { BACK: { target: "a" } } },
      },
    });
    const result = check(machine, {
      checks: {
        unreachableStates: false,
        deadStates: false,
        deadTransitions: false,
        invalidTargets: false,
        nondeterminism: false,
        missingInitial: false,
        effectsWithoutCancel: false,
      },
      bounded: {
        enabled: true,
        maxPathDepth: 0,
        maxStatesExplored: 10_000,
        maxTransitions: 10_000,
        maxCycleLength: 20,
        timeoutMs: 5_000,
      },
    });
    expect(result.stats.bounded).toBe(true);
    expect(result.stats.hitLimit).toBe(true);
  });

  it("warning-only results from bounded analysis still pass", () => {
    const machine = createMachine({
      id: "m",
      initial: "a",
      states: {
        a: { on: { GO: { target: "b" } } },
        b: { type: "final" },
      },
    });
    const result = check(machine, {
      bounded: {
        enabled: true,
        maxPathDepth: 100,
        maxStatesExplored: 100,
        maxTransitions: 1000,
        maxCycleLength: 20,
        timeoutMs: 5000,
      },
    });
    expect(result.passed).toBe(true);
    expect(result.stats.bounded).toBe(true);
  });
});
