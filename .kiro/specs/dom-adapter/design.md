# DOM Adapter Design

## Overview

`@stategraph/dom` provides framework-free helpers around the core actor contract. It owns DOM event listeners and cleanup, but all statechart semantics remain in `@stategraph/core`.

## Public API

```ts
mountActor(machine, options?): { actor, cleanup }
bindEvent(element, domEventType, actor, stateEvent): () => void
onSnapshot(actor, handler): () => void
```

## Data Flow

```mermaid
flowchart LR
    Element["DOM Element"] --> Listener["bindEvent listener"]
    Listener --> Event["StateGraph event"]
    Event --> Actor["Core ActorRef"]
    Actor --> Snapshot["Snapshot"]
    Snapshot --> Handler["onSnapshot handler"]
    Handler --> DOM["DOM update"]
```

## Lifecycle

`mountActor` creates and starts an actor and returns an idempotent cleanup function. `bindEvent` and `onSnapshot` return independent unsubscribe functions. If users compose these manually, each cleanup path must be safe to call once or more.

## Error Handling

Invalid elements or missing actor capabilities should fail with descriptive errors. Runtime errors come from the core actor and are not reinterpreted by DOM helpers.

## Testing Strategy

Use Vitest with `jsdom` or `happy-dom`. Tests cover shared conformance and DOM event listener behavior.
