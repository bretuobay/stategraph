# @stategraph/vue

> **Post-MVP — not yet published.** This package is a stub. See the [roadmap](../../README.md).

Vue 3 adapter for StateGraph actors. Will provide `useActor`, `useActorRef`, and `useSelector` returning `ComputedRef` values, matching the adapter API defined in ADR-009.

## Planned API

```ts
// useActor — reactive snapshot + send
const { snapshot, send } = useActor(machine);
console.log(snapshot.value.context.count); // ComputedRef<number>

// useSelector — derived ComputedRef with equality check
const count = useSelector(actor, (snap) => snap.context.count);
```

## Status

Stub package. Not installable from the registry. Watch the repository for the Vue adapter milestone.
