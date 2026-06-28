# ADR-001: Object DSL Shape

**Status:** Accepted  
**Date:** 2026-06-28  
**Deciders:** StateGraph TS core team

---

## Context

The PRD (§8.1) requires two authoring surfaces: an object DSL as the primary public API, and a builder API for advanced inference. The object DSL must be serializable (powering devtools, model checking, visual editing, and test generation), strongly typed, and migration-friendly for XState users.

The core tension is between serializability (no inline functions) and TypeScript ergonomics (inference without manual annotation). XState v5 resolves this with a `types:` phantom field, which is a type-level hack. We need a cleaner approach.

---

## Decision

Use a `setup()` factory that captures type information, followed by `.createMachine()` with the declarative machine definition. The bare `createMachine()` form also works for untyped and migrated machines.

```ts
const machine = setup({
  guards: {
    isValid: ({ context }: { context: FormCtx }) => context.value.length > 0,
  },
  actions: {
    setError: assign(({ event }: { event: ErrorEvent }) => ({ error: event.message })),
    clearError: assign(() => ({ error: null })),
  },
  effects: {
    submitForm: fromPromise(({ input }: { input: { url: string } }) =>
      fetch(input.url).then(r => r.json())
    ),
  },
}).createMachine({
  id: 'form',
  initial: 'idle',
  context: { value: '', error: null },
  states: {
    idle: {
      on: {
        SUBMIT: { target: 'submitting', guard: 'isValid' },
      },
    },
    submitting: {
      entry: ['clearError'],
      invoke: {
        src: 'submitForm',
        input: ({ context }) => ({ url: '/api/submit' }),
        onDone: 'success',
        onError: { target: 'idle', actions: ['setError'] },
      },
    },
    success: { type: 'final' },
  },
})
```

### State node fields

| Field | Type | Notes |
|---|---|---|
| `type` | `'atomic' \| 'compound' \| 'parallel' \| 'final' \| 'history'` | Omit for atomic (default) |
| `initial` | `string` | Required for compound; forbidden elsewhere |
| `states` | `Record<string, StateNodeDef>` | Nested; forbidden for atomic |
| `history` | `'shallow' \| 'deep'` | Only when `type: 'history'` |
| `on` | `Record<EventType, TransitionDef \| TransitionDef[]>` | Event → transition map |
| `always` | `TransitionDef \| TransitionDef[]` | Eventless/auto transitions |
| `after` | `Record<number \| string, TransitionDef>` | Delayed events |
| `entry` | `ActionRef \| ActionRef[]` | String refs or `{ type, params }` objects |
| `exit` | `ActionRef \| ActionRef[]` | Same shape as `entry` |
| `invoke` | `InvokeDef \| InvokeDef[]` | Invoked async effects/services |
| `meta` | `Record<string, unknown>` | Arbitrary metadata for tooling |

### Transition shape

```ts
interface TransitionDef {
  target?: string;                    // omit for targetless/internal
  guard?: GuardRef;                   // string or { type: string; params: unknown }
  actions?: ActionRef[];
  effects?: EffectRef[];              // fire-and-forget (non-invoked)
  reenter?: boolean;                  // force re-entry of the current state
  meta?: Record<string, unknown>;
}
```

### Core invariants

- All guard, action, and effect references in the DSL are **strings** (serializable). Implementations are never embedded in the definition object.
- Implementations are registered in `setup()` (typed, close to definition) and can be overridden in `createActor(machine, { provide: { ... } })` for dependency injection and testing.
- The serialized definition must round-trip through JSON without loss of semantics.
- `createMachine(definition)` without `setup()` produces a valid machine with string references unresolved; resolution happens at `createActor` time.

---

## Consequences

**Positive:**
- Full TypeScript inference without phantom type annotation hacks.
- DSL is JSON-serializable for tooling consumption.
- `provide:` at `createActor` time makes testing and DI straightforward.
- XState users find the nested `states`/`on` shape familiar.

**Negative:**
- Two-step authoring (`setup()` then `.createMachine()`) is slightly more ceremony than a single call.
- String references mean compile-time checking of guard/action names requires the `setup()` wrapper; bare `createMachine()` loses that safety.

---

## Alternatives Considered

**A. Generic-first `createMachine<TContext, TEvent>(...)`** — forces manual annotation at every call site; violates the "TypeScript-first ergonomics without heavy annotation" goal.

**B. Phantom `types:` field (XState v5 pattern)** — works but is a type-level trick that confuses readers and produces misleading error messages.

**C. Fully flat state map with dot-path keys** — `{ 'idle': ..., 'submitting': ... }` — loses hierarchical structure in the definition, making visual tooling harder and requiring reconstruction at IR build time.
