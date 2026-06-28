# @stategraph/dom

Headless DOM adapter for StateGraph actors. Mounts machines, binds DOM events to actor events, and drives UI updates from snapshots — no framework required.

## Installation

```sh
pnpm add @stategraph/dom @stategraph/core
```

## Quick start

```ts
import { setup } from "@stategraph/core";
import { bindEvent, mountActor, onSnapshot } from "@stategraph/dom";

const toggleMachine = setup({}).createMachine({
  id: "toggle",
  initial: "off",
  context: {},
  states: {
    off: { on: { TOGGLE: { target: "on" } } },
    on:  { on: { TOGGLE: { target: "off" } } },
  },
});

const btn = document.getElementById("toggle-btn")!;
const label = document.getElementById("label")!;

const { actor, cleanup } = mountActor(toggleMachine);

bindEvent(btn, "click", actor, { type: "TOGGLE" });

onSnapshot(actor, (snap) => {
  label.textContent = `State: ${snap.value as string}`;
  btn.textContent = snap.value === "on" ? "Turn off" : "Turn on";
});

// When done: cleanup()
```

## API

### `mountActor(machine, options?)`

Creates and starts an actor. Returns `{ actor, cleanup }` where `cleanup()` stops the actor (idempotent).

```ts
const { actor, cleanup } = mountActor(machine);
```

### `bindEvent(element, domEventType, actor, stateEvent)`

Attaches a DOM event listener that sends a StateGraph event to the actor. The `stateEvent` argument can be:

- A **static event object** — sent as-is on every DOM event.
- A **mapping function** — receives the DOM `Event` and returns the StateGraph event.

Returns an unsubscribe function.

```ts
// Static
const unsub = bindEvent(btn, "click", actor, { type: "SUBMIT" });

// Mapping — extract input value
const unsub = bindEvent(input, "input", actor, (e) => ({
  type: "CHANGE",
  value: (e.target as HTMLInputElement).value,
}));

// Remove listener
unsub();
```

### `onSnapshot(actor, handler)`

Subscribes to committed snapshots. Calls `handler` each time the actor produces a new snapshot.

Returns an unsubscribe function.

```ts
const unsub = onSnapshot(actor, (snap) => {
  el.textContent = snap.value as string;
});
```

## Patterns

### Parallel machine state

For parallel machines `snap.value` is a nested object. Use `snap.configuration` (flat set of active node IDs) for reliable checks:

```ts
onSnapshot(actor, (snap) => {
  const isPlaying = snap.configuration.has("player.playback.playing");
  const isMuted   = snap.configuration.has("player.volume.muted");
  playBtn.textContent = isPlaying ? "Pause" : "Play";
  muteBtn.textContent = isMuted   ? "Unmute" : "Mute";
});
```

### Dynamic event from DOM

```ts
bindEvent(playBtn, "click", actor, (e) => {
  const label = (e.currentTarget as HTMLButtonElement).textContent ?? "";
  return label === "Pause" ? { type: "PAUSE" } : { type: "PLAY" };
});
```

### Cleanup on page unload

```ts
const { actor, cleanup } = mountActor(machine);
window.addEventListener("beforeunload", cleanup);
```
