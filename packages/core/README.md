# @stategraph/core

The pure TypeScript statechart runtime. Zero dependencies, zero framework imports, zero browser globals. Everything else in StateGraph TS builds on top of this package.

## Installation

```sh
pnpm add @stategraph/core
```

## Core concepts

### Machines

A machine is a serializable description of states, transitions, guards, actions, and effects. Define it with `setup()` + `.createMachine()`. Guards, actions, and effects are **string references** in the definition — never inline functions.

```ts
import { assign, fromPromise, setup } from "@stategraph/core";

const machine = setup({
  guards: {
    isValid: ({ context }) => context.value.trim().length > 0,
  },
  actions: {
    setValue: assign(({ event }) => ({ value: event.value })),
    clearError: assign(() => ({ error: null })),
  },
  effects: {
    submitForm: fromPromise(({ input, signal }) =>
      fetch(input.url, { method: "POST", signal }).then((r) => r.json()),
    ),
  },
}).createMachine({
  id: "form",
  initial: "idle",
  context: { value: "", error: null },
  states: {
    idle: {
      on: {
        CHANGE: { actions: ["setValue"] },
        SUBMIT: { target: "submitting", guard: "isValid", actions: ["clearError"] },
      },
    },
    submitting: {
      invoke: {
        src: "submitForm",
        input: ({ context }) => ({ url: "/api/submit" }),
        onDone: "success",
        onError: "idle",
      },
    },
    success: { type: "final" },
  },
});
```

### Actors

An actor runs a machine instance. It is started, receives events, and exposes a snapshot subscription.

```ts
import { createActor } from "@stategraph/core";

const actor = createActor(machine);
actor.start();

actor.send({ type: "CHANGE", value: "hello" });
actor.send({ type: "SUBMIT" });

const snap = actor.getSnapshot();
console.log(snap.value);   // "submitting"
console.log(snap.context); // { value: "hello", error: null }

const unsub = actor.subscribe((snapshot) => {
  console.log(snapshot.value);
});

actor.stop();
unsub();
```

### Override implementations at test or DI time

```ts
createActor(machine, {
  provide: {
    guards: { isValid: () => true },
    effects: { submitForm: fromPromise(async () => ({ id: 42 })) },
  },
});
```

## API

### `setup(implementations)`

Returns a builder with one method, `.createMachine(definition)`.

| Field | Type | Description |
|---|---|---|
| `guards` | `Record<string, GuardImplementation>` | Guard functions keyed by reference name |
| `actions` | `Record<string, ActionImplementation \| AssignAction>` | Action and assign implementations |
| `effects` | `Record<string, EffectDefinition>` | Effect implementations (`fromPromise`, `fromCallback`, `fromObservable`) |

### `createActor(machine, options?)`

| Option | Type | Description |
|---|---|---|
| `id` | `string` | Override the actor's runtime ID |
| `provide` | `Partial<SetupImplementations>` | Override guards, actions, or effects at runtime |
| `inspect` | `(event: TraceEvent) => void` | Subscribe to raw trace events |

### `assign(mapper)`

The only way to update context. Returns an `AssignAction` that shallow-merges the partial result.

```ts
assign<Ctx>(({ context }) => ({ count: context.count + 1 }))
assign<Ctx, Evt>(({ event }) => ({ value: event.value }))
```

### `fromPromise(fn)`

Async effect. The `signal` is an `AbortSignal` that fires when the state exits.

```ts
fromPromise<Input, Output>(({ input, signal }) =>
  fetch(input.url, { signal }).then((r) => r.json())
)
```

### `fromCallback(fn)`

Subscribe-style effect with a `sendBack` for events and a cleanup return.

```ts
fromCallback(({ input, sendBack, signal }) => {
  const id = setInterval(() => sendBack({ type: "TICK" }), input.interval);
  signal.addEventListener("abort", () => clearInterval(id));
})
```

### Snapshot shape

```ts
interface StateGraphSnapshot<TContext, TEvent> {
  status: "idle" | "active" | "done" | "error" | "stopped";
  value: string | Record<string, StateValue>; // nested for compound/parallel states
  configuration: ReadonlySet<string>;         // flat set of active node IDs
  context: Readonly<TContext>;
  changed: boolean;
  event: TEvent | { type: "@@INIT" } | null;
  nextEvents: ReadonlyArray<string>;          // event types that trigger at least one transition from the current configuration
  firedTransitions: ReadonlyArray<{ source: string; target: string | null; eventType: string }>;
  pendingEffects: ReadonlyArray<{ id: string; src: string; input: unknown }>;
  children: Readonly<Record<string, ChildActorRef>>;
  error: unknown;
  _traceId: string | undefined;
}
```

**`nextEvents` vs `firedTransitions`:** These two fields are often confused.

- `nextEvents` — event types that will trigger at least one transition from the **current** configuration. Use this to drive UI (enable/disable buttons, show available actions). Walks the full ancestor chain so inherited transitions are included. Sorted alphabetically.
- `firedTransitions` — transitions that **fired in the last step** (a trace record). Use this for devtools, logging, and test assertions — not for deciding what to render next.

```ts
// Drive a button from the current state
const events = snapshot.nextEvents; // ["SUBMIT", "RESET"]

// Assert what just happened in a test
expect(snapshot.firedTransitions).toEqual([
  { source: "form.idle", target: "form.submitting", eventType: "SUBMIT" },
]);
```

**Tip:** For parallel machines, `snap.value` is a nested object. Use `snap.configuration` (a flat set of node IDs like `"machine.region.state"`) for reliable state checks.

### State types

| Type | Description |
|---|---|
| `atomic` | Leaf state with no children |
| `compound` | Has child states and an `initial` |
| `parallel` | All child regions are simultaneously active |
| `final` | Terminal state; actor status becomes `"done"` |
| `history` | Shallow or deep history pseudostate (restores last active leaf) |

## Runtime semantics

- **Run-to-completion**: one external event fully resolves before the next is processed.
- **Entry/exit order**: exit actions run before entry actions on every transition.
- **Effects after commit**: effects are scheduled after the transition step completes.
- **Deterministic parallel**: parallel regions update in definition order.
- **Immutable context**: `assign()` shallow-merges a new partial — never mutates in place.

## Package boundaries

- No framework imports (`react`, `vue`, etc.)
- No browser globals (`window`, `document`, etc.)
- No test-framework imports (`vitest`, `jest`, etc.)
- All other StateGraph packages import from this package's barrel (`@stategraph/core`), never from its internal files.
