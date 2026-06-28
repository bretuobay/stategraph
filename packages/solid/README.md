# @stategraph/solid

> **Post-MVP — not yet published.** This package is a stub. See the [roadmap](../../README.md).

SolidJS adapter for StateGraph actors. Will provide `createActor` and `createSelector` returning reactive signals, matching the adapter API defined in ADR-009.

## Planned API

```ts
// createActor — returns [snapshot signal, send]
const [snapshot, send] = createActor(machine);
const count = () => snapshot().context.count; // derived accessor

// createSelector — fine-grained reactive selection
const count = createSelector(actor, (snap) => snap.context.count);
```

## Status

Stub package. Not installable from the registry. Watch the repository for the SolidJS adapter milestone.
