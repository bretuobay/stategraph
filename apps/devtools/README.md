# StateGraph DevTools

A browser-based inspector panel for StateGraph actors. Shows active states, event and transition logs, guard results, context diffs, effect lifecycle, and the full trace history for every connected actor.

Powered by `@stategraph/inspect` — all data is versioned `TraceEnvelope` JSON, so traces can be exported, imported, and replayed independently of the app under inspection.

## Running

```sh
pnpm dev --filter @stategraph/devtools
```

Opens at `http://localhost:5173` (or the next available port).

## Connection modes

### Demo

Click **Load Demo** to immediately explore the panel using a pre-recorded checkout-form trace. No app required. The demo covers all 11 trace event types (`@actor.started`, `@event.received`, `@transition.fired`, `@action.executed`, `@context.updated`, `@effect.started`, `@effect.done`, `@effect.error`, `@effect.cancelled`, `@actor.stopped`, `@error`).

### Live (postMessage)

Click **Connect Live** in the devtools panel, then add a bridge call to any actor in your app:

```ts
import { createActor } from "@stategraph/core";
import { createDevtoolsBridge } from "@stategraph/inspect";

const actor = createActor(machine).start();

createDevtoolsBridge(actor, {
  machineId: machine.id,
  channel: {
    postMessage: (msg) => window.postMessage(msg, "*"),
  },
});
```

The devtools panel must be open in the **same browser window** as your app for `window.postMessage` to reach it. Use `window.parent.postMessage` or `window.opener.postMessage` if the panel is in an iframe or a separate window.

When multiple actors connect, they each appear as a separate row in the **Actors** sidebar. Select one to view its event log.

#### Late connection: sending a replay snapshot

If the devtools panel opens after the actor has already processed events, pass `sendSnapshot: true` to the bridge so it emits a full `trace:snapshot` message on connect:

```ts
createDevtoolsBridge(actor, {
  machineId: machine.id,
  sendSnapshot: true,
  channel: {
    postMessage: (msg) => window.postMessage(msg, "*"),
  },
});
```

The panel will load the full history from that snapshot rather than starting from an empty log.

#### Filtering trace events

Use the `filter` option to reduce noise:

```ts
createDevtoolsBridge(actor, {
  machineId: machine.id,
  channel: { postMessage: (msg) => window.postMessage(msg, "*") },
  filter: (event) => event.type !== "@action.executed",
});
```

### Import / Export

Use the **Export Trace** button to download the selected actor's full trace as a `.trace.json` file. Use **Import Trace** to load any previously exported file — the imported session appears immediately in the Actors sidebar.

Import and export use the versioned `TraceEnvelope` format from `@stategraph/inspect`. Imported traces can also be replayed programmatically:

```ts
import { deserializeEnvelope, replayTrace } from "@stategraph/inspect";

const envelope = deserializeEnvelope(json);
const { snapshots } = replayTrace(machine, envelope);
```

## UI overview

```
┌───────────────────────────────────────────────────────────────────────┐
│ ◆ StateGraph DevTools                    [Load Demo] [Connect Live]   │
├──────────────┬─────────────────────────────────┬──────────────────────┤
│ ACTORS       │ EVENT LOG                       │ Active States        │
│              │ seq  time   type    detail       │                      │
│ checkoutForm │  1   0ms   actor.started        │ filling              │
│   (stopped)  │  2  245ms  event.received START │                      │
│              │  3  246ms  transition.fired  ──►│ Context              │
│              │  4  246ms  action.executed   ──►│ { email: "...", ...} │
│              │  5  1.1s   event.received   ──► │                      │
│              │  ...                            │ Event #12            │
│              │ ► 12  3s   transition.fired     │ source: filling      │
│ [Export]     │           filling → submitting  │ target: submitting   │
│ [Import]     │                                 │ guard: isFormValid ✓ │
└──────────────┴─────────────────────────────────┴──────────────────────┘
```

- **Actors sidebar** — one row per connected actor, showing machine ID, actor ID, status (`active` / `stopped`), and event count.
- **Event log** — all trace events in sequence order. Each row shows sequence number, timestamp (ms since actor started), event type (color-coded), and a one-line summary. Click any row to inspect it in the detail panel.
- **Detail panel** — three sections:
  - *Active States* — the current configuration, derived from `@actor.started` snapshot and subsequent `@transition.fired` targets.
  - *Context* — the current context object, built by replaying `@context.updated` patches from the initial snapshot.
  - *Event Detail* — the selected trace event expanded: transition source/target, guard results (pass/fail badges), action type and params, effect ID and input/output, or context patch.

## Event type color reference

| Color | Event types |
|---|---|
| Blue | `@event.received` |
| Purple | `@transition.fired` |
| Teal | `@action.executed`, `@context.updated` |
| Yellow | `@effect.started` |
| Green | `@actor.started`, `@effect.done` |
| Red | `@effect.error`, `@error` |
| Orange | `@effect.cancelled` |
| Dim | `@actor.stopped` |

## Architecture

```
apps/devtools/src/
  machine.ts              # State machine: idle | listening | active
  channel/
    demoTrace.ts          # Hardcoded TraceEnvelope for demo mode
  hooks/
    useDevtools.ts        # Wires machine + postMessage + export/import
  ui/
    App.tsx               # Three-column layout and toolbar
    ActorList.tsx         # Sidebar actor list
    EventLog.tsx          # Scrollable trace event table
    DetailPanel.tsx       # Active states, context, event detail
    ExportImport.tsx      # Export/import file controls
  main.tsx                # Vite entry point
```

The devtools panel is itself a StateGraph actor: `devtoolsMachine` has three states.

- `idle` — no session connected; shows the connection prompt.
- `listening` — live mode active, waiting for the first `TRACE_RECEIVED` event.
- `active` — at least one session is loaded (live, demo, or imported).

Trace data accumulates in context as `Record<actorId, SessionData>` — one entry per actor session, each holding the ordered `InspectTraceEvent[]` array.
