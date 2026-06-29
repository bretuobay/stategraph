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

## DevtoolsOverlay

An embeddable devtools panel — like React Query DevTools — that auto-discovers every actor created via `useActor` / `useActorRef` in the same app.

### Setup

Import from the dedicated subpath so it is tree-shaken in production:

```tsx
import { DevtoolsOverlay } from "@stategraph/react/devtools";
```

Mount it once near the root of your app, guarded by a dev-only condition:

```tsx
// src/App.tsx
import { DevtoolsOverlay } from "@stategraph/react/devtools";

export function App() {
  return (
    <>
      <YourRoutes />
      {import.meta.env.DEV && <DevtoolsOverlay />}
    </>
  );
}
```

No other changes are required. Every `useActor` / `useActorRef` call anywhere in the tree is automatically instrumented.

### What you see

The overlay renders as a fixed panel anchored to the bottom of the viewport:

```
┌──────────────────────────────────────────────────────────────┐
│ ◆ StateGraph DevTools   3 actors · 41 events          −   × │
├──────────────┬────────────────────────────────┬──────────────┤
│ Actors       │ Event log                      │ Event detail │
│              │  #  time  type        detail   │              │
│ checkoutForm │  1   0ms  started              │ seq  3       │
│ authMachine  │  2   4ms  event       SUBMIT   │ ts   12ms    │
│ navMachine   │  3  12ms  transition  idle→… ◀ │ source idle  │
│              │  4  15ms  action      clear…   │ target submit│
└──────────────┴────────────────────────────────┴──────────────┘
```

- **Actors** — all live and stopped actors, coloured by status.
- **Event log** — every trace event in arrival order, with timestamp relative to actor start. Auto-scrolls; click a row to inspect.
- **Event detail** — structured fields for the selected event: guard results for transitions, patches for context updates, input/output for effects.

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `defaultOpen` | `boolean` | `true` | Whether the panel starts expanded. |

### How it works

`DevtoolsOverlay` calls `activateDevtools()` from the internal `devtoolsStore`. The store uses `globalThis.__stategraph_devtools_handler` as a cross-bundle singleton, so the handler set by the devtools bundle is visible to the main bundle even when bundlers split them into separate chunks. Each actor is registered via `actor.inspect()`, which emits the full `InspectTraceEvent` stream used by `@stategraph/inspect`.

### Browser extension (Option B — planned Phase 2)

For teams that cannot or do not want to ship any devtools code into their bundle, a browser extension is planned. It would:

1. Inject a tiny `contentScript` (< 2 kB) that hooks `window.postMessage`.
2. Any app using `@stategraph/react` automatically forwards trace events via `postMessage` when the extension is installed (no app-side change required).
3. The extension panel (built on `apps/devtools`) receives events over the `chrome.runtime.connect` channel and displays the same UI as `DevtoolsOverlay`.

This mirrors how React DevTools and Redux DevTools work. The extension approach has zero production bundle cost but requires browser support and cannot be embedded in non-browser environments (SSR, RN, Electron without extension support). The `DevtoolsOverlay` is the recommended starting point; the extension reuses the same `@stategraph/inspect` protocol so traces are portable between both.

## Peer dependencies

- `react` ≥ 18.0.0
- `react-dom` ≥ 18.0.0
