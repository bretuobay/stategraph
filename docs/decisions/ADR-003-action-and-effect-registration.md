# ADR-003: Action and Effect Registration Syntax

**Status:** Accepted  
**Date:** 2026-06-28  
**Deciders:** StateGraph TS core team

---

## Context

The PRD defines actions as synchronous, traceable operations that may update context through explicit APIs only (§6.7), and effects as asynchronous or external operations that must be explicit, cancellable, and visible in traces (§6.8). Neither may use arbitrary inline functions in the serialized DSL.

Three questions needed resolving:
1. How do actions express context updates without direct mutation?
2. How do effects wrap async/callback/observable logic?
3. Where are implementations registered, and how are they overridden?

---

## Decision

### Actions

Two action kinds are supported:

**1. Context-assignment actions** — use `assign()`. The only way to update context.

```ts
// Function form — receives { context, event }
assign(({ context, event }) => ({ count: context.count + 1 }))

// Object shorthand — each value is a mapper function
assign({
  count: ({ context }) => context.count + 1,
  lastEvent: ({ event }) => event.type,
})
```

`assign()` returns a partial context update. The runtime merges it shallowly; deep merging is the caller's responsibility. The runtime enforces immutability: any guard, plain action, or effect that mutates `context` directly throws in dev mode.

**2. Side-effect actions** — plain functions registered in `setup()`. Return `void`.

```ts
setup({
  actions: {
    logEvent: ({ context, event }) => {
      console.log('[state]', event.type)
    },
    trackAnalytics: ({ event }) => {
      analytics.track(event.type)
    },
  },
})
```

**Parameterized actions** — when a DSL transition needs to pass static configuration to an action:

```ts
// In DSL:
entry: [{ type: 'toast', params: { message: 'Saved!' } }]

// In setup():
actions: {
  toast: ({ context, event }, params: { message: string }) => {
    showToast(params.message)
  },
}
```

`params` are typed and checked at the call site in the DSL.

**Built-in action helpers (MVP):**

```ts
assign(mapper)    // context update
log(mapper)       // console output in dev mode, no-op in prod
raise(event)      // send an internal event to self
```

---

### Effects

Three effect creators are provided. All return a typed `EffectDefinition` that the runtime invokes; they do not execute immediately.

**`fromPromise`** — for one-shot async operations. Auto-cancelled via `AbortSignal` on state exit.

```ts
fromPromise<TInput, TOutput>(
  fn: ({ input, signal }: { input: TInput; signal: AbortSignal }) => Promise<TOutput>
)

// Example:
effects: {
  fetchUser: fromPromise(({ input, signal }) =>
    fetch(`/api/users/${input.id}`, { signal }).then(r => r.json())
  ),
}
```

**`fromCallback`** — for long-running subscriptions, event emitters, or WebSockets. Cleanup function cancels on state exit.

```ts
fromCallback<TInput, TSendBack>(
  fn: ({ input, sendBack, receive, signal }) => CleanupFn | void
)

// Example:
effects: {
  listenSocket: fromCallback(({ input, sendBack }) => {
    const ws = new WebSocket(input.url)
    ws.onmessage = e => sendBack({ type: 'MESSAGE', data: e.data })
    return () => ws.close()
  }),
}
```

**`fromObservable`** — post-MVP. Type stub only in MVP to avoid blocking the extension point.

```ts
// MVP: type stub, throws at runtime
fromObservable<TInput, TOutput>(fn: ({ input }) => Observable<TOutput>): EffectDefinition
```

---

### Registration and Override

Implementations are registered in `setup()` (close to definition, fully typed):

```ts
const machine = setup({ guards, actions, effects }).createMachine({ ... })
```

They are overridden at `createActor` time for dependency injection and testing:

```ts
createActor(machine, {
  provide: {
    guards: {
      isValid: () => true,             // always pass in test
    },
    actions: {
      toast: () => {},                 // no-op in test
    },
    effects: {
      fetchUser: fromPromise(async () => fixtures.user),
    },
  },
})
```

`provide:` is a partial override — only the keys listed are replaced. Unoverridden implementations fall back to those registered in `setup()`. If neither registration exists, the runtime throws at `createActor` time with a descriptive error listing the missing names.

---

## Consequences

**Positive:**
- `assign()` makes all context mutations explicit and traceable; accidental mutation is detectable.
- `fromPromise` / `fromCallback` cover the vast majority of async patterns; adding `fromObservable` post-MVP does not require any DSL changes.
- `provide:` enables full effect mocking without a separate mock library.
- Named string references + `provide:` is sufficient for effect-level dependency injection without a DI container.

**Negative:**
- The `assign()` shallow-merge contract requires callers to spread nested objects manually; deep-update helpers are not provided in MVP (can be added as a utility).
- `fromObservable` being a stub may surprise users coming from RxJS-heavy Angular projects; documentation must set expectations.

---

## Alternatives Considered

**A. Inline function implementations in the DSL** — breaks serializability and makes graph inspection, visual editing, and migration tooling impossible.

**B. Immer-style draft mutation inside `assign()`** — convenient but hides the mutation model, and Immer is a runtime dependency. Can be offered as an opt-in helper post-MVP (`assignImmer()`).

**C. Separate `services` key for invoked effects (XState v4 pattern)** — `invoke.src` is cleaner and allows multiple invocations in one state; the old `services` key would require an alias and adds confusion.
