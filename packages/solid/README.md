# @stategraph/solid

> **Post-MVP - not yet published.** This package is specified but not implemented.

SolidJS adapter for StateGraph actors. It provides fine-grained reactive primitives for actor lifecycle, snapshot accessors, derived selectors, and context sharing while preserving the core actor contract.

This adapter must follow ADR-009 and pass the shared `@stategraph/testing` adapter conformance suite before publication.

## API Contract

### `createActor(machine, options?)`

Creates and starts one actor in the current Solid owner and returns a snapshot accessor, stable `send` function, and actor ref.

```ts
import { createActor } from "@stategraph/solid";

const [snapshot, send, actor] = createActor(counterMachine);

send({ type: "INC" });
console.log(snapshot().context.count);
```

Required behavior:

- Creates the actor once for the current reactive owner.
- Starts the actor before exposing the initial snapshot.
- Updates the snapshot signal on every committed actor snapshot.
- Registers cleanup with `onCleanup`.
- Cleanup is idempotent.
- Does not access browser globals during setup, so SSR render paths are safe.

Note: `@stategraph/solid` exports a Solid primitive named `createActor`. Documentation must distinguish it from `createActor` in `@stategraph/core`, which creates a programmatic runtime actor.

### `createSelector(actor, selector, compare?)`

Creates a derived accessor from an actor snapshot.

```ts
const count = createSelector(actor, (snap) => snap.context.count);
const isDirty = createSelector(actor, (snap) => snap.context.dirty, Object.is);
```

Required behavior:

- Defaults equality to `Object.is`.
- Updates only when the selected value changes by the equality function.
- Returns the selected value for the current actor snapshot immediately.
- Unsubscribes with the current owner cleanup.

### `StateGraphProvider` / `useActorContext`

Share an actor through Solid context.

```tsx
const [snapshot, send, actor] = createActor(machine);

<StateGraphProvider actor={actor}>
  <Child />
</StateGraphProvider>;

const childActor = useActorContext<typeof actor>();
```

Required behavior:

- Provides a stable default context for the common single-actor case.
- Allows package users to create custom contexts for multiple actors.
- Throws a clear error when no actor is available.
- Never creates a second actor when consuming context.

## Type Requirements

- Infer `SnapshotOf<TMachine>` and `EventOf<TMachine>` from the supplied machine.
- Preserve event type safety on `send`.
- Return Solid `Accessor` types for snapshots and selectors.
- Expose Solid types as peer types, not bundled framework shims.

## SSR Requirements

- The adapter must be import-safe in SSR builds.
- Server rendering may create owners, accessors, and initial snapshot values.
- The adapter must not read `window`, `document`, or DOM APIs at module import time.

## Conformance Tests

The package must include tests covering:

- Shared adapter conformance via `defineAdapterConformanceSuite`.
- Initial snapshot availability through the accessor.
- Event dispatch through `send`.
- Selector equality with default and custom comparators.
- Cleanup through Solid owner disposal.
- Context sharing without duplicate actor creation.
- SSR import and render safety.

## Status

Specified post-MVP package. It must remain private and clearly unpublished until implementation, tests, and peer dependency declarations are complete.
