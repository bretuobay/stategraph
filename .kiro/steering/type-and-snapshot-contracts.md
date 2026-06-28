---
inclusion: always
---

# TypeScript Rules and Core Type Contracts

## TypeScript strictness (TRD §4.1)

All packages must compile with:

```jsonc
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true,
  "noImplicitOverride": true
}
```

Rules:
- No `any` in public APIs. Use `unknown`, generics, or branded types.
- Public API `.d.ts` files must not widen any type to `any`.
- Invalid event types must fail at compile time when the actor type is known.
- Write compile-time type tests (`expectTypeOf`, `assertType`) for: inferred event unions, invalid event rejection, context assignment typing, guard/action/effect parameter types, selector return types, adapter hook return types.

## Snapshot shape (ADR-004)

```ts
type SnapshotStatus = 'idle' | 'active' | 'done' | 'error' | 'stopped'

type StateValue =
  | string                           // atomic:   'idle'
  | Record<string, StateValue>       // compound/parallel: { player: { playback: 'playing' } }

interface StateGraphSnapshot<
  TContext,
  TEvent extends { type: string } = { type: string },
> {
  status: SnapshotStatus
  value: StateValue
  configuration: ReadonlySet<string>   // flat set of all active state node IDs
  context: Readonly<TContext>
  changed: boolean                     // false = context + value unchanged from previous snapshot
  event: TEvent | { type: '@@INIT' } | null
  transitions: ReadonlyArray<{
    readonly source: string
    readonly target: string | null
    readonly eventType: string
  }>
  pendingEffects: ReadonlyArray<{
    readonly id: string       // stable per-invocation UUID
    readonly src: string      // effect name
    readonly input: unknown
  }>
  children: Readonly<Record<string, ChildActorRef>>
  error: unknown              // typed unknown — effect rejections may not be Error instances
  _traceId: string | undefined
}
```

Key rules:
- `configuration` is always derivable from `value` + the machine definition; both must stay in sync.
- `changed` is set by the runtime via `Object.is` on `context` + structural equality on `value`. Adapters must use it to skip re-renders, not compute their own diff.
- `pendingEffects` allows tests to assert scheduled effects without inspecting runtime internals.

## Adapter contract (TRD §9)

All adapters consume this contract from `@stategraph/core`. They must not depend on private actor internals.

```ts
interface StateGraphActor<TSnapshot, TEvent> {
  send(event: TEvent): void
  getSnapshot(): TSnapshot
  subscribe(listener: (snapshot: TSnapshot) => void): () => void
  inspect?(listener: (trace: TraceEvent) => void): () => void
}
```

## Trace schema (ADR-005)

Trace envelopes are owned by `@stategraph/inspect`:

```ts
interface TraceEnvelope {
  schemaVersion: string    // 'MAJOR.MINOR', e.g. '1.0'
  sessionId: string        // UUIDv4
  machineId: string
  actorId: string
  createdAt: number        // Unix ms
  events: TraceEvent[]
}
```

All trace events extend `{ seq: number; ts: number; actorId: string }` and are discriminated by `type` using the `@namespace.verb` convention (e.g., `@actor.started`, `@effect.done`).

Validation: `@stategraph/inspect` must export `parseTraceEnvelope(raw: unknown): TraceEnvelope` using Zod. Devtools and replay call this before consuming any trace. Mismatched MAJOR versions throw `UnsupportedSchemaVersionError`.

## Intermediate representation (TRD §8)

Every machine must be convertible to a serializable IR containing: state node IDs, hierarchy, parallel region metadata, initial/final/history nodes, transitions, event names, guard/action/effect references, protocol contracts, and optional source locations. The IR must not contain executable code.
