---
inclusion: fileMatch: ["packages/react/**", "packages/vue/**", "packages/angular/**", "packages/solid/**", "packages/svelte/**", "packages/dom/**"]
---

# Adapter API Names and Patterns (ADR-009)

All adapters wrap the same `StateGraphActor` contract. They may add idiomatic APIs but must **not** alter runtime semantics or execute effects outside the actor runtime.

Each adapter must pass the shared conformance test suite in `@stategraph/testing` plus framework-specific lifecycle tests.

---

## React (`@stategraph/react`)

```ts
// Primary hook — actor tied to component lifecycle, re-renders on every snapshot change
useActor(machine: Machine, options?: ActorOptions)
  // → { snapshot, send, actor }

// Stable actor ref — does NOT subscribe to snapshots; no re-render on its own
useActorRef(machine: Machine, options?: ActorOptions)
  // → ActorRef

// Selector — re-renders only when selected value changes (uses Object.is by default)
useSelector(actor: ActorRef, selector: (s: TSnapshot) => T, compare?: (a: T, b: T) => boolean)
  // → T

// Send-only — never triggers re-renders
useSend(actor: ActorRef)
  // → (event: TEvent) => void

// Subtree sharing
StateGraphContext    // React.Context<ActorRef | null>
StateGraphProvider  // <StateGraphProvider actor={...}>{children}</StateGraphProvider>
useActorContext()   // → ActorRef from nearest provider
```

Fine-grained pattern (preferred for performance):
```tsx
const actor = useActorRef(machine)
const status = useSelector(actor, s => s.value)
const send   = useSend(actor)
```

---

## Vue (`@stategraph/vue`)

```ts
// Primary composable — snapshot is a Ref<Snapshot>
useActor(machine: Machine, options?: ActorOptions)
  // → { snapshot: Ref<Snapshot>, send, actor }

// Stable actor ref (not reactive)
useActorRef(machine: Machine, options?: ActorOptions)
  // → ActorRef

// Computed selector
useSelector(actor: ActorRef, selector: (s: TSnapshot) => T)
  // → ComputedRef<T>
```

---

## Angular (`@stategraph/angular`)

```ts
// Provider factory — use in providers array (NgModule or standalone)
provideActor(machine: Machine, options?: ActorOptions)
  // → EnvironmentProviders

// Injectable base service — extend or inject directly
@Injectable()
class ActorService<TMachine> {
  readonly snapshot$: Observable<SnapshotOf<TMachine>>
  readonly actor: ActorRef
  send(event: EventOf<TMachine>): void
  ngOnDestroy(): void
}

// RxJS interop
toObservable(actor: ActorRef)                         // → Observable<Snapshot>
selectObservable(actor: ActorRef, selector: Fn)       // → Observable<T>

// Signal interop (Angular 16+)
toSignal(actor: ActorRef, selector?: Fn)              // → Signal<T>
```

---

## Solid (`@stategraph/solid`)

Follows `create*` convention — NOT `use*`.

```ts
// Primary primitive — tuple like createSignal
createActor(machine: Machine, options?: ActorOptions)
  // → [snapshot: Accessor<Snapshot>, send: SendFn, actor: ActorRef]

// Derived signal
createSelector(actor: ActorRef, selector: (s: TSnapshot) => T)
  // → Accessor<T>
```

---

## Svelte (`@stategraph/svelte`)

```ts
// Returns Svelte-compatible readable store
actorStore(machine: Machine, options?: ActorOptions)
  // → { snapshot: Readable<Snapshot>, send: SendFn, actor: ActorRef }

// Derived selector store
selectorStore(actor: ActorRef, selector: (s: TSnapshot) => T)
  // → Readable<T>
```

Svelte 5 rune-compatible API is post-MVP. Do not add it until the Svelte 4 store API is stable.

---

## Vanilla DOM (`@stategraph/dom`)

```ts
// Mount actor and return cleanup
mountActor(machine: Machine, options?: ActorOptions)
  // → { actor: ActorRef, cleanup: () => void }

// Bind DOM event to actor event
bindEvent(element: Element, domEvent: string, actor: ActorRef, stateEvent: TEvent | ((e: Event) => TEvent))
  // → unsubscribe: () => void

// Subscribe to snapshot changes
onSnapshot(actor: ActorRef, handler: (snapshot: TSnapshot) => void)
  // → unsubscribe: () => void
```

---

## Summary

| Framework | Create | Select | Send |
|---|---|---|---|
| React | `useActor` / `useActorRef` | `useSelector` | `useSend` |
| Vue | `useActor` / `useActorRef` | `useSelector` → `ComputedRef` | `send` from `useActor` |
| Angular | `provideActor` / `ActorService` | `selectObservable` / `toSignal` | `service.send` |
| Solid | `createActor` | `createSelector` | via tuple |
| Svelte | `actorStore` | `selectorStore` | via return |
| DOM | `mountActor` | `onSnapshot` | `bindEvent` |

Note: `createActor` in `@stategraph/solid` is a reactive primitive (returns a signal accessor tuple).
`createActor` in `@stategraph/core` is the programmatic actor factory (returns an `ActorRef`).
These have different signatures — do not confuse them.
