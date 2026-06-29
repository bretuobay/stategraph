# @stategraph/vue

> **Post-MVP - not yet published.** This package is specified but not implemented.

Vue 3 adapter for StateGraph actors. It provides composables for actor lifecycle, snapshot refs, derived selectors, and subtree sharing while preserving the core actor contract.

This adapter must follow ADR-009 and pass the shared `@stategraph/testing` adapter conformance suite before publication.

## API Contract

### `useActor(machine, options?)`

Creates and starts one actor for the current component instance. Returns a reactive snapshot ref, a stable `send` function, and the underlying actor.

```ts
import { useActor } from "@stategraph/vue";

const { snapshot, send, actor } = useActor(counterMachine);

send({ type: "INC" });
console.log(snapshot.value.context.count);
```

Required behavior:

- Creates the actor once for the calling component lifecycle.
- Starts the actor before exposing the initial snapshot.
- Updates `snapshot.value` on every committed actor snapshot.
- Stops the actor from `onUnmounted`.
- Cleanup is idempotent.
- Does not access browser globals during setup, so SSR render paths are safe.

### `useActorRef(machine, options?)`

Creates and starts an actor tied to the current component lifecycle without subscribing the component to snapshot updates.

```ts
const actor = useActorRef(formMachine);
```

Use this when children or selectors should control subscription granularity.

### `useSelector(actor, selector, compare?)`

Returns a `ComputedRef<T>` derived from an actor snapshot.

```ts
const count = useSelector(actor, (snap) => snap.context.count);
const status = useSelector(actor, (snap) => snap.value, Object.is);
```

Required behavior:

- Defaults equality to `Object.is`.
- Recomputes only when the selected value changes by the equality function.
- Emits the selected value for the current actor snapshot immediately.
- Unsubscribes when the enclosing effect scope is disposed.

### `provideActor(actor, key?)` / `useActorContext(key?)`

Share an actor through Vue provide/inject for a subtree.

```ts
const actor = useActorRef(machine);
provideActor(actor);

const childActor = useActorContext<typeof actor>();
```

Required behavior:

- Uses a stable injection key exported by the package by default.
- Allows a custom key for multiple actors in the same subtree.
- Throws a clear error when no actor is provided.
- Never creates a second actor when consuming context.

## Type Requirements

- Infer `SnapshotOf<TMachine>` and `EventOf<TMachine>` from the supplied machine.
- Preserve event type safety on `send`.
- Preserve actor type when passing through `provideActor` and `useActorContext`.
- Expose Vue types as peer types, not bundled framework shims.

## SSR Requirements

- Server rendering may create refs and compute initial values.
- The adapter must not read `window`, `document`, or DOM APIs at module import time.
- Actor effects that require browser APIs remain the user's responsibility and should be guarded in the machine implementation.

## Conformance Tests

The package must include tests covering:

- Shared adapter conformance via `defineAdapterConformanceSuite`.
- Initial snapshot availability.
- Event dispatch through `send`.
- Selector equality with default and custom comparators.
- Lifecycle cleanup on component unmount and effect-scope disposal.
- Actor sharing through provide/inject without duplicate actor creation.
- SSR import and render safety.

## Status

Specified post-MVP package. It must remain private and clearly unpublished until implementation, tests, and peer dependency declarations are complete.
