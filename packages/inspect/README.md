# @stategraph/inspect

Trace recording, serialization, devtools transport, and deterministic replay for StateGraph actors. All trace data is versioned JSON that can be stored, diffed, and replayed without re-executing real side effects.

## Installation

```sh
pnpm add @stategraph/inspect @stategraph/core
```

## Concepts

- **TraceEnvelope** — a versioned JSON document (`schemaVersion: "1.0"`) containing an ordered sequence of `InspectTraceEvent` records emitted by an actor during its lifetime.
- **createTraceRecorder** — attaches to an actor's inspect channel and accumulates a `TraceEnvelope` in memory.
- **parseTraceEnvelope / serializeEnvelope / deserializeEnvelope** — validate, import, and export envelopes with Zod-like structural checking. Unknown major schema versions throw `UnsupportedSchemaVersionError`.
- **createDevtoolsBridge** — forwards trace events over any generic channel (postMessage, WebSocket, etc.) to a devtools consumer.
- **replayTrace** — replays a recorded `TraceEnvelope` against a fresh actor, substituting captured effect outputs for real I/O to produce a deterministic snapshot sequence.

## Recording a trace

```ts
import { createActor } from "@stategraph/core";
import { createTraceRecorder } from "@stategraph/inspect";

const actor = createActor(machine);
const recorder = createTraceRecorder(actor, { machineId: machine.id });

actor.start();
actor.send({ type: "SUBMIT" });
actor.stop();

const envelope = recorder.getEnvelope();
// { schemaVersion: "1.0", sessionId: "...", machineId: "form", ... }

recorder.stop(); // detach
```

## Serializing and storing

```ts
import { serializeEnvelope, deserializeEnvelope } from "@stategraph/inspect";

const json = serializeEnvelope(envelope);      // JSON string
localStorage.setItem("trace", json);

// Later:
const restored = deserializeEnvelope(json);    // validates on import
```

## Replaying a trace

```ts
import { replayTrace } from "@stategraph/inspect";

const { snapshots, replayedEvents } = replayTrace(machine, envelope);
// snapshots: ordered array of StateGraphSnapshot produced during replay
// replayedEvents: the external events that were re-sent
```

Effect results from `@effect.done` / `@effect.error` trace entries drive auto-resolving `fromPromise` mocks — no real network calls during replay. Override specific effects with `options.effects`:

```ts
replayTrace(machine, envelope, {
  effects: { submitForm: fromPromise(async () => ({ ok: true })) },
});
```

## Devtools bridge

```ts
import { createDevtoolsBridge } from "@stategraph/inspect";

const bridge = createDevtoolsBridge(actor, {
  channel: { postMessage: (msg) => window.parent.postMessage(msg, "*") },
  machineId: machine.id,
});

// In devtools panel:
window.addEventListener("message", (e) => {
  if (isBridgeMessage(e.data)) {
    // e.data.type === "trace:event" | "trace:snapshot"
  }
});

bridge.stop();
```

## Trace event types

| Type | Emitted when |
|---|---|
| `@actor.started` | Actor `.start()` is called |
| `@actor.stopped` | Actor `.stop()` is called |
| `@event.received` | An external event is sent to the actor |
| `@transition.fired` | A transition completes |
| `@action.executed` | An action runs |
| `@effect.started` | An effect is invoked |
| `@effect.done` | A promise/callback effect resolves |
| `@effect.error` | A promise/callback effect rejects |
| `@effect.cancelled` | An effect is cancelled (state exit) |
| `@context.updated` | Context changes via `assign()` |
| `@error` | An unhandled runtime error |

## Schema versioning

Every envelope has `schemaVersion: "1.0"`. A MAJOR version bump (`2.0`, `3.0`) is a breaking change. `parseTraceEnvelope` / `deserializeEnvelope` throw `UnsupportedSchemaVersionError` for unknown major versions. Unknown event types within a supported version are silently dropped (forward compatibility).
