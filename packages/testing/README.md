# @stategraph/testing

Test utilities for StateGraph machines: graph-based test-plan generation, controllable effect mocks, and an adapter conformance suite that all framework adapters must pass.

## Installation

```sh
pnpm add -D @stategraph/testing @stategraph/core
```

## Test-plan generation

Derive test cases directly from a machine's structure. Plans cover every reachable state, every transition, every path, invalid-event resilience, and guard branches — without writing events by hand.

```ts
import {
  createStateCoveragePlan,
  createTransitionCoveragePlan,
  createPathCoveragePlan,
  createInvalidEventPlan,
  createGuardBranchPlan,
  emitVitestTests,
} from "@stategraph/testing";

const statePlan      = createStateCoveragePlan(machine);
const transitionPlan = createTransitionCoveragePlan(machine);
const pathPlan       = createPathCoveragePlan(machine, { maxDepth: 4 });
const invalidPlan    = createInvalidEventPlan(machine);
const guardPlan      = createGuardBranchPlan(machine, {
  fixtures: [
    {
      guard: "isValid",
      enabledEvents:  [{ type: "CHANGE", value: "hello" }, { type: "SUBMIT" }],
      disabledEvents: [{ type: "SUBMIT" }],
    },
  ],
});

// Emit a Vitest-runnable test file
const src = emitVitestTests([statePlan, transitionPlan], { suiteName: "form machine" });
console.log(src);
```

### Plan types

| Function | What it covers |
|---|---|
| `createStateCoveragePlan` | One path to each reachable state |
| `createTransitionCoveragePlan` | One path that fires each transition |
| `createPathCoveragePlan` | All distinct reachable paths up to `maxDepth` |
| `createInvalidEventPlan` | Unrecognised event ignored in every atomic/final state |
| `createGuardBranchPlan` | Both branches (enabled + disabled) for each guarded transition |

### Options

```ts
createStateCoveragePlan(machine, {
  maxDepth: 5,   // BFS depth limit (default: 5)
  maxCases: 100, // cap on generated cases (default: 100)
});
```

## Effect mocks

Replace real network/timer effects with controllable mocks in unit tests.

### Promise effect mock

```ts
import { createPromiseEffectMock } from "@stategraph/testing";

const mock = createPromiseEffectMock<{ url: string }, { ok: boolean }>();

const actor = createActor(machine, {
  provide: { effects: { submitForm: mock.effect } },
});
actor.start();
actor.send({ type: "SUBMIT" });

expect(actor.getSnapshot().value).toBe("submitting");
mock.resolve({ ok: true }); // settle the pending promise
expect(actor.getSnapshot().value).toBe("success");

mock.reset(); // clear calls for the next test
```

### Callback effect mock

```ts
import { createCallbackEffectMock } from "@stategraph/testing";

const mock = createCallbackEffectMock<{ interval: number }>();

const actor = createActor(machine, {
  provide: { effects: { ticker: mock.effect } },
});
actor.start();

mock.sendBack({ type: "TICK" }); // trigger an event from the effect
expect(actor.getSnapshot().context.ticks).toBe(1);

expect(mock.cleanupCalls).toBe(0);
actor.stop();
expect(mock.cleanupCalls).toBe(1); // cleanup ran on exit
```

## Adapter conformance suite

All framework adapters must pass this shared suite. It verifies: correct initial snapshot, event dispatch, snapshot subscriptions, selector equality, and idempotent cleanup.

```ts
import { defineAdapterConformanceSuite } from "@stategraph/testing";

const suite = defineAdapterConformanceSuite({
  name: "MyAdapter",
  createMachine: () => myTestMachine,
  mount({ machine, onSnapshot, selector, onSelected }) {
    // Mount using the adapter under test
    return { actor, send, getSnapshot, cleanup, handle };
  },
  dispatchEvent: { type: "TOGGLE" },
  noopEvent:     { type: "NOOP" },
  expectInitial(snap)      { expect(snap.value).toBe("off"); },
  expectAfterDispatch(snap){ expect(snap.value).toBe("on"); },
});

// Run all conformance tests in Vitest
for (const test of suite.tests) {
  it(test.name, () => test.run());
}
```

## Machine IR utilities

Lower-level helpers for inspecting machine structure:

```ts
import { enumerateStates, enumerateTransitions } from "@stategraph/testing";

const states      = enumerateStates(machine);      // sorted, with depth
const transitions = enumerateTransitions(machine); // sorted, with guard/action refs
```
