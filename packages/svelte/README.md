# @stategraph/svelte

> **Post-MVP — not yet published.** This package is a stub. See the [roadmap](../../README.md).

Svelte adapter for StateGraph actors. Will provide `actorStore` and `selectorStore` returning Svelte-compatible readable stores, matching the adapter API defined in ADR-009.

## Planned API

```svelte
<script>
  import { actorStore, selectorStore } from "@stategraph/svelte";

  const { store, send } = actorStore(machine);
  const count = selectorStore(store, (snap) => snap.context.count);
</script>

<p>Count: {$count}</p>
<button on:click={() => send({ type: "INC" })}>+</button>
```

## Status

Stub package. Not installable from the registry. Watch the repository for the Svelte adapter milestone.
