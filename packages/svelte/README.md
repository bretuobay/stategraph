# @stategraph/svelte

> **Post-MVP - not yet published.** This package is specified but not implemented.

Svelte adapter for StateGraph actors. It provides Svelte-compatible readable stores for actor snapshots, selector derivation, event sending, and context sharing while preserving the core actor contract.

This adapter must follow ADR-009 and pass the shared `@stategraph/testing` adapter conformance suite before publication.

## API Contract

### `actorStore(machine, options?)`

Creates a StateGraph actor and exposes its snapshots as a Svelte readable store.

```svelte
<script lang="ts">
  import { actorStore } from "@stategraph/svelte";

  const { snapshot, send, actor } = actorStore(counterMachine);
</script>

<p>Count: {$snapshot.context.count}</p>
<button on:click={() => send({ type: "INC" })}>+</button>
```

Required behavior:

- Starts the actor when the first store subscriber is attached.
- Publishes the initial actor snapshot immediately to subscribers.
- Stops the actor when the last subscriber unsubscribes, unless the caller opts into an externally managed actor.
- Cleanup is idempotent.
- Does not access browser globals at module import time.

### `selectorStore(actor, selector, compare?)`

Creates a readable store for a selected value from actor snapshots.

```svelte
<script lang="ts">
  const count = selectorStore(actor, (snap) => snap.context.count);
</script>

<p>Count: {$count}</p>
```

Required behavior:

- Defaults equality to `Object.is`.
- Publishes the selected current value immediately to subscribers.
- Updates only when the selected value changes by the equality function.
- Unsubscribes from the actor when the store has no subscribers.

### `setActorContext(actor, key?)` / `getActorContext(key?)`

Share an actor through Svelte context.

```svelte
<script lang="ts">
  const { actor } = actorStore(machine);
  setActorContext(actor);
</script>
```

```svelte
<script lang="ts">
  const actor = getActorContext();
</script>
```

Required behavior:

- Uses a stable package context key by default.
- Supports a custom key for multiple actors in a component tree.
- Throws a clear error when no actor is available.
- Never creates a second actor when consuming context.

## Type Requirements

- Infer `SnapshotOf<TMachine>` and `EventOf<TMachine>` from the supplied machine.
- Preserve event type safety on `send`.
- Return Svelte `Readable<T>` types for snapshots and selectors.
- Expose Svelte types as peer types, not bundled framework shims.

## Svelte Version Scope

- The initial contract targets Svelte 4 readable stores and remains compatible with Svelte 5 store usage.
- Rune-specific helpers may be added later as separate exports without replacing `actorStore` or `selectorStore`.

## SSR Requirements

- The adapter must be import-safe in SSR builds.
- Store creation must not require `window`, `document`, or DOM APIs.
- Browser-only machine effects remain the user's responsibility.

## Conformance Tests

The package must include tests covering:

- Shared adapter conformance via `defineAdapterConformanceSuite`.
- Initial store value.
- Event dispatch through `send`.
- Selector equality with default and custom comparators.
- Start/stop behavior across store subscriber counts.
- Context sharing without duplicate actor creation.
- SSR import and render safety.

## Status

Specified post-MVP package. It must remain private and clearly unpublished until implementation, tests, and peer dependency declarations are complete.
