# @stategraph/react

React 18+ adapter for StateGraph actors. Provides hooks for mounting machines, subscribing to snapshots, and sending events — all with full TypeScript inference.

## Installation

```sh
pnpm add @stategraph/react @stategraph/core
# react and react-dom are peer dependencies
```

## Quick start

```tsx
import { setup, assign } from "@stategraph/core";
import { useActor } from "@stategraph/react";

const counterMachine = setup({
  actions: {
    inc: assign<{ count: number }>(({ context }) => ({ count: context.count + 1 })),
  },
}).createMachine({
  id: "counter",
  initial: "active",
  context: { count: 0 },
  states: {
    active: { on: { INC: { actions: ["inc"] } } },
  },
});

function Counter() {
  const { snapshot, send } = useActor(counterMachine);
  return (
    <button onClick={() => send({ type: "INC" })}>
      Count: {snapshot.context.count}
    </button>
  );
}
```

## API

### `useActor(machine, options?)`

Creates, starts, and subscribes to an actor scoped to the component lifecycle. Returns `{ snapshot, send, actor }`.

The actor is created once on mount and stopped on unmount. Re-renders on every new snapshot.

```tsx
const { snapshot, send, actor } = useActor(machine);
```

### `useActorRef(machine, options?)`

Like `useActor` but returns only the `ActorRef` — no automatic re-render. Useful when you want to manage subscriptions manually or pass the ref to child hooks.

```tsx
const actor = useActorRef(machine);
```

### `useSelector(actor, selector, compare?)`

Subscribes to a derived value from the actor's snapshot. Re-renders only when the selected value changes (uses `Object.is` by default; pass a custom `compare` to control equality).

```tsx
const count = useSelector(actor, (snap) => snap.context.count);
const isActive = useSelector(actor, (snap) => snap.value === "active");
```

### `useSend(actor)`

Returns a stable `send` function. Useful for passing down without triggering child re-renders.

```tsx
const send = useSend(actor);
```

### `StateGraphProvider` / `useActorContext`

Share an actor through React context without prop-drilling.

```tsx
// Parent
<StateGraphProvider actor={actor}>
  <Child />
</StateGraphProvider>

// Child
function Child() {
  const actor = useActorContext<MyCtx, MyEvent>();
  const send = useSend(actor);
  // ...
}
```

## Patterns

### Async effect with loading state

```tsx
const { snapshot, send } = useActor(formMachine);
const isSubmitting = snapshot.value === "submitting";

return (
  <button onClick={() => send({ type: "SUBMIT" })} disabled={isSubmitting}>
    {isSubmitting ? "Saving…" : "Submit"}
  </button>
);
```

### Selecting from context

```tsx
// Re-renders only when `count` changes, not on every snapshot
const count = useSelector(actor, (snap) => snap.context.count);
```

### Parallel state

For parallel machines, `snapshot.value` is a nested object. Use `snapshot.configuration` for reliable checks:

```tsx
const isPlaying = snapshot.configuration.has("player.playback.playing");
```

## Peer dependencies

- `react` ≥ 18.0.0
- `react-dom` ≥ 18.0.0
