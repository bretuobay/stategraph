# ADR-009: Adapter API Names per Framework

**Status:** Accepted  
**Date:** 2026-06-28  
**Deciders:** StateGraph TS core team

---

## Context

The PRD (§10.2–10.4) requires official adapters for React, Vue, Angular, Solid, Svelte, and vanilla DOM. Each must provide actor creation/lifecycle integration, snapshot subscription, selector subscription, send helpers, and effect lifecycle cleanup — all through idiomatic APIs for that framework.

The adapter contract from the TRD (§9) is:

```ts
interface StateGraphActor<TSnapshot, TEvent> {
  send(event: TEvent): void
  getSnapshot(): TSnapshot
  subscribe(listener: (snapshot: TSnapshot) => void): () => void
  inspect?(listener: (trace: TraceEvent) => void): () => void
}
```

Adapters wrap this contract; they must not alter core runtime semantics.

---

## Decision

### React (`@stategraph/react`)

Follows the `use*` hook convention. Compatible with React 18+ concurrent rendering.

```ts
/**
 * Primary hook. Creates an actor tied to the component lifecycle.
 * Re-renders on every snapshot change.
 */
useActor(machine: Machine, options?: ActorOptions): {
  snapshot: StateGraphSnapshot<TContext, TEvent>
  send: (event: TEvent) => void
  actor: ActorRef<TSnapshot, TEvent>
}

/**
 * Returns a stable actor ref without subscribing to snapshot changes.
 * Pair with useSelector to control what triggers re-renders.
 */
useActorRef(machine: Machine, options?: ActorOptions): ActorRef<TSnapshot, TEvent>

/**
 * Subscribe to a derived value. Re-renders only when the selected value changes.
 * Optional equality function for custom comparison (defaults to Object.is).
 */
useSelector<T>(
  actor: ActorRef,
  selector: (snapshot: TSnapshot) => T,
  compare?: (a: T, b: T) => boolean
): T

/** Send-only handle. Does not subscribe to snapshot; never triggers re-renders. */
useSend(actor: ActorRef): (event: TEvent) => void

// Context-based sharing for subtrees
const StateGraphContext: React.Context<ActorRef | null>
function StateGraphProvider(props: { actor: ActorRef; children: ReactNode }): JSX.Element
function useActorContext<TActor extends ActorRef>(): TActor
```

Usage pattern:
```tsx
// Fine-grained: only re-renders when 'status' changes
const actor = useActorRef(formMachine)
const status = useSelector(actor, s => s.value)
const send = useSend(actor)
```

---

### Vue (`@stategraph/vue`)

Follows the `use*` composable convention. Returns Vue reactive refs.

```ts
/**
 * Primary composable. Actor lifecycle tied to the calling component.
 */
useActor(machine: Machine, options?: ActorOptions): {
  snapshot: Ref<StateGraphSnapshot<TContext, TEvent>>
  send: (event: TEvent) => void
  actor: ActorRef<TSnapshot, TEvent>
}

/**
 * Stable actor ref. Not reactive itself — combine with useSelector.
 */
useActorRef(machine: Machine, options?: ActorOptions): ActorRef<TSnapshot, TEvent>

/**
 * Computed selector. Reactive; updates only when selected value changes.
 */
useSelector<T>(
  actor: ActorRef,
  selector: (snapshot: TSnapshot) => T
): ComputedRef<T>
```

---

### Angular (`@stategraph/angular`)

Follows Angular's injectable service and signal/observable patterns. Compatible with both NgModule and standalone component setups.

```ts
/** Base injectable service. Extend per machine or use directly with provideActor(). */
@Injectable()
class ActorService<TMachine extends AnyMachine> {
  readonly snapshot$: Observable<SnapshotOf<TMachine>>
  readonly actor: ActorRef<SnapshotOf<TMachine>, EventOf<TMachine>>
  send(event: EventOf<TMachine>): void
  ngOnDestroy(): void
}

/** Provider factory for Angular's DI system (NgModule + standalone). */
function provideActor<TMachine extends AnyMachine>(
  machine: TMachine,
  options?: ActorOptions
): EnvironmentProviders

/** RxJS interop — snapshot stream from any actor ref. */
function toObservable<TSnapshot>(actor: ActorRef<TSnapshot>): Observable<TSnapshot>

/** RxJS selector stream. */
function selectObservable<TSnapshot, T>(
  actor: ActorRef<TSnapshot>,
  selector: (snapshot: TSnapshot) => T
): Observable<T>

/** Angular signal interop (requires Angular 16+). */
function toSignal<TSnapshot, T = TSnapshot>(
  actor: ActorRef<TSnapshot>,
  selector?: (snapshot: TSnapshot) => T
): Signal<T>
```

---

### Solid (`@stategraph/solid`)

Follows Solid's `create*` convention for reactive primitives. Returns signal accessors for fine-grained reactivity.

```ts
/**
 * Primary primitive. Returns a tuple: [snapshotAccessor, send, actorRef].
 * Follows createSignal() and createResource() tuple convention.
 */
function createActor<TMachine extends AnyMachine>(
  machine: TMachine,
  options?: ActorOptions
): [
  snapshot: Accessor<SnapshotOf<TMachine>>,
  send: (event: EventOf<TMachine>) => void,
  actor: ActorRef<SnapshotOf<TMachine>, EventOf<TMachine>>,
]

/**
 * Derived signal. Updates only when the selected value changes.
 */
function createSelector<TSnapshot, T>(
  actor: ActorRef<TSnapshot>,
  selector: (snapshot: TSnapshot) => T
): Accessor<T>
```

---

### Svelte (`@stategraph/svelte`)

Exposes Svelte-compatible readable stores. Compatible with Svelte 4's `$store` auto-subscription syntax.

```ts
/**
 * Primary function. Returns a readable store for snapshot and a send function.
 */
function actorStore<TMachine extends AnyMachine>(
  machine: TMachine,
  options?: ActorOptions
): {
  snapshot: Readable<SnapshotOf<TMachine>>
  send: (event: EventOf<TMachine>) => void
  actor: ActorRef<SnapshotOf<TMachine>, EventOf<TMachine>>
}

/**
 * Derived selector store. Updates only when selected value changes.
 */
function selectorStore<TSnapshot, T>(
  actor: ActorRef<TSnapshot>,
  selector: (snapshot: TSnapshot) => T
): Readable<T>
```

Svelte 5 rune-based API (`$state`, `$derived`) will be added post-MVP as a separate export without removing the store API.

---

### Vanilla DOM (`@stategraph/dom`)

No framework primitives. Provides lifecycle-aware actor mounting and DOM event binding helpers.

```ts
/**
 * Mount an actor with automatic cleanup on unmount.
 * Returns a cleanup function to call when the DOM element is removed.
 */
function mountActor<TMachine extends AnyMachine>(
  machine: TMachine,
  options?: ActorOptions
): {
  actor: ActorRef<SnapshotOf<TMachine>, EventOf<TMachine>>
  cleanup: () => void
}

/**
 * Bind a DOM event to an actor event.
 * Returns an unsubscribe function.
 */
function bindEvent<TEvent extends { type: string }>(
  element: Element,
  domEventType: string,
  actor: ActorRef<any, TEvent>,
  stateEvent: TEvent | ((domEvent: Event) => TEvent)
): () => void

/**
 * Subscribe to actor snapshot changes and update the DOM.
 */
function onSnapshot<TSnapshot>(
  actor: ActorRef<TSnapshot>,
  handler: (snapshot: TSnapshot) => void
): () => void
```

---

### Summary table

| Framework | Create actor | Select derived value | Send event | Share across tree |
|---|---|---|---|---|
| React | `useActor` / `useActorRef` | `useSelector` | `useSend` | `StateGraphProvider` + `useActorContext` |
| Vue | `useActor` / `useActorRef` | `useSelector` → `ComputedRef` | `send` from `useActor` | Provide/inject pattern with `useActorRef` |
| Angular | `ActorService` / `provideActor` | `selectObservable` / `toSignal` | `service.send` | Angular DI |
| Solid | `createActor` | `createSelector` | `send` from tuple | Solid context |
| Svelte | `actorStore` | `selectorStore` | `send` from return | Svelte context |
| DOM | `mountActor` | `onSnapshot` + manual filter | `bindEvent` | N/A |

---

## Consequences

**Positive:**
- Each framework adapter uses the idiomatic naming convention for that ecosystem — no cross-framework confusion.
- `useSelector` appears in both React and Vue (same concept, same name), reducing cognitive cost for polyglot teams.
- `createActor` in Solid aligns with the Solid `create*` convention used by `createSignal`, `createEffect`, etc.
- All adapters are thin wrappers over the same actor contract — changing the runtime never changes adapter API names.

**Negative:**
- `createActor` is used in Solid's adapter but is also a top-level export from `@stategraph/core` (with different semantics). Documentation must clearly distinguish `@stategraph/core`'s `createActor` (programmatic) from `@stategraph/solid`'s `createActor` (reactive primitive).
- Angular's `ActorService` requires understanding Angular DI to use; a lightweight functional API for standalone components (`provideActor`) is provided as an alternative entry point.

---

## Alternatives Considered

**A. Uniform names across all adapters (e.g., always `useActor`)** — breaks Solid's `create*` convention and Angular's service pattern. Would feel unnatural in each framework's idiom.

**B. Prefix all exports with `sg` (e.g., `sgActor`, `sgSelector`)** — avoids naming conflicts but is verbose and un-ergonomic. Standard practice is to use idiomatic names and rely on import aliasing for conflict resolution.

**C. Single `useStateGraph` hook returning everything** — common in naive adapters, but forces consumers to subscribe to all snapshot changes regardless of which slice they need. The selector pattern (`useSelector`, `useActorRef` + `useSelector`) is the standard solution for this.
