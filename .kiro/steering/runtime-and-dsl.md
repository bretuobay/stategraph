---
inclusion: always
---

# Runtime Semantics and DSL Rules

## DSL authoring pattern (ADR-001)

The machine definition object must be **JSON-serializable**. No inline functions in the definition.
Guards, actions, and effects are **string references** in the DSL. Implementations are registered in `setup()`.

```ts
// Correct pattern
const machine = setup({
  guards: {
    isValid: ({ context }) => context.value.length > 0,
  },
  actions: {
    clearError: assign(() => ({ error: null })),
    setError:   assign(({ event }) => ({ error: event.message })),
  },
  effects: {
    submitForm: fromPromise(({ input, signal }) =>
      fetch(input.url, { signal }).then(r => r.json())
    ),
  },
}).createMachine({
  id: 'form',
  initial: 'idle',
  context: { value: '', error: null },
  states: {
    idle: {
      on: { SUBMIT: { target: 'submitting', guard: 'isValid' } },
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

| Field | Notes |
|---|---|
| `type` | `'atomic'` (default, omit), `'compound'`, `'parallel'`, `'final'`, `'history'` |
| `initial` | Required for compound; forbidden for atomic/parallel/final |
| `states` | Nested state map; forbidden for atomic |
| `history` | `'shallow'` or `'deep'`; only when `type: 'history'` |
| `on` | `{ EVENT: TransitionDef }` — event → transition map |
| `always` | Eventless/auto transitions |
| `after` | `{ 1000: TransitionDef }` — delayed events |
| `entry` / `exit` | `ActionRef[]` — string refs or `{ type, params }` |
| `invoke` | Invoked async effect/service |
| `meta` | Arbitrary metadata for tooling |

### Transition shape

```ts
{
  target?: string           // omit for targetless/internal transitions
  guard?: string | { type: string; params: unknown }
  actions?: ActionRef[]
  effects?: EffectRef[]     // fire-and-forget (non-invoked)
  reenter?: boolean         // force re-entry of current state
  meta?: Record<string, unknown>
}
```

## Context immutability (ADR-003)

Context is **never mutated in place**. Use `assign()` — the only permitted way to update context.

```ts
// Correct
assign(({ context }) => ({ count: context.count + 1 }))
assign({ count: ({ context }) => context.count + 1 })   // shorthand

// Wrong — will throw in dev mode
actions: { increment: ({ context }) => { context.count++ } }
```

## Effect creators (ADR-003)

```ts
// Promise-based — AbortSignal injected automatically; cancelled on state exit
fromPromise<TInput, TOutput>(fn: ({ input, signal }) => Promise<TOutput>)

// Callback-based — for websockets, event emitters, subscriptions
fromCallback<TInput>(fn: ({ input, sendBack, receive, signal }) => CleanupFn | void)

// Observable — MVP: type stub only, throws at runtime
fromObservable<TInput, TOutput>(fn: ({ input }) => Observable<TOutput>)
```

Override at `createActor` time for testing or DI:

```ts
createActor(machine, {
  provide: {
    guards:  { isValid: () => true },
    actions: { toast: () => {} },
    effects: { submitForm: fromPromise(async () => ({ ok: true })) },
  },
})
```

## Runtime semantics (TRD §6)

### Run-to-completion
One external event fully resolves — including all enabled internal/generated transitions — before the next external event starts. Subscribers observe only consistent snapshots.

### Determinism
Given the same machine, initial context, event sequence, and effect results, the runtime produces the same snapshot sequence. Ordering is fixed:
- Exit: innermost state first (depth-first, document order within parallel).
- Entry: outermost state first.
- Transition actions: after exit, before entry.
- Effects: scheduled after the transition step commits.

### Effect scheduling
Effects are **explicit runtime requests** scheduled after transition commits. Framework adapters must not execute effects outside the actor runtime.

## Builder API (ADR-002)

`setup()` is the only builder surface in MVP. A full imperative builder (`.addState()`, `.addTransition()`) is post-MVP and lives under `experimental`. Do not add it to MVP code.
